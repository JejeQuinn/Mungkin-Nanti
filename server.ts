import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import { users, schedules, feedingLogs, statusPakan } from "./src/db/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import { adminAuth } from "./src/lib/firebase-admin.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Firebase Auth verification middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    const token = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error);
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  };

  // Helper to get or create a user in PostgreSQL
  const getOrCreateUser = async (uid: string, email: string) => {
    try {
      // Check if user exists
      let existingUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (existingUser.length > 0) {
        return existingUser[0];
      }

      // Create user
      const newUser = await db.insert(users).values({ uid, email }).returning();
      const userRecord = newUser[0];

      // Initialize default status
      await db.insert(statusPakan).values({
        userId: userRecord.id,
        persentase: 78,
        jarakCm: 6.74,
        terakhirDiperbarui: new Date(),
      }).onConflictDoNothing();

      // Initialize default schedules
      await db.insert(schedules).values([
        { userId: userRecord.id, waktu: "07:00", isActive: true, triggerManual: false },
        { userId: userRecord.id, waktu: "12:00", isActive: true, triggerManual: false },
        { userId: userRecord.id, waktu: "17:00", isActive: true, triggerManual: false },
      ]);

      // Seed initial logs
      const defaultLogs = [
        { userId: userRecord.id, metode: "Otomatis", status: "Berhasil", waktuEksekusi: new Date(Date.now() - 3 * 3600 * 1000) },
        { userId: userRecord.id, metode: "Manual", status: "Berhasil", waktuEksekusi: new Date(Date.now() - 8 * 3600 * 1000) },
        { userId: userRecord.id, metode: "Otomatis", status: "Berhasil", waktuEksekusi: new Date(Date.now() - 24 * 3600 * 1000) },
      ];
      for (const log of defaultLogs) {
        await db.insert(feedingLogs).values(log);
      }

      return userRecord;
    } catch (err) {
      console.error("Error in getOrCreateUser:", err);
      throw err;
    }
  };

  // --- API Routes ---

  // User Synchronization
  app.post("/api/auth/sync", requireAuth, async (req: any, res: any) => {
    try {
      const { uid, email } = req.user;
      const userRecord = await getOrCreateUser(uid, email || "user@feeder.io");
      res.json({ success: true, user: userRecord });
    } catch (err: any) {
      console.error("Error in /api/auth/sync:", err);
      res.status(500).json({ error: "Failed to synchronize user" });
    }
  });

  // Get Schedules
  app.get("/api/schedules", requireAuth, async (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (userList.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const userRecord = userList[0];

      const userSchedules = await db
        .select()
        .from(schedules)
        .where(eq(schedules.userId, userRecord.id))
        .orderBy(schedules.waktu);

      res.json(userSchedules);
    } catch (err: any) {
      console.error("Error fetching schedules:", err);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  // Update/Save Schedules (Accepts list of schedules)
  app.post("/api/schedules", requireAuth, async (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (userList.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const userRecord = userList[0];

      const { list } = req.body; // Array of { id?: number, waktu: string, isActive: boolean, triggerManual?: boolean }
      if (!Array.isArray(list)) {
        return res.status(400).json({ error: "Invalid schedule list format" });
      }

      // Delete existing schedules for this user
      await db.delete(schedules).where(eq(schedules.userId, userRecord.id));

      // Insert new schedules
      if (list.length > 0) {
        const insertData = list.map((item) => ({
          userId: userRecord.id,
          waktu: item.waktu,
          isActive: item.isActive,
          triggerManual: item.triggerManual || false,
        }));
        await db.insert(schedules).values(insertData);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error saving schedules:", err);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  // Get Feeder Status
  app.get("/api/status", requireAuth, async (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (userList.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const userRecord = userList[0];

      let currentStatus = await db
        .select()
        .from(statusPakan)
        .where(eq(statusPakan.userId, userRecord.id))
        .limit(1);

      if (currentStatus.length === 0) {
        const newStatus = await db.insert(statusPakan).values({
          userId: userRecord.id,
          persentase: 78,
          jarakCm: 6.74,
          terakhirDiperbarui: new Date(),
        }).returning();
        return res.json(newStatus[0]);
      }

      res.json(currentStatus[0]);
    } catch (err: any) {
      console.error("Error fetching status:", err);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  // Update Feeder Status
  app.post("/api/status", requireAuth, async (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (userList.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const userRecord = userList[0];

      const { persentase, jarakCm } = req.body;
      if (persentase === undefined || jarakCm === undefined) {
        return res.status(400).json({ error: "Missing required status fields" });
      }

      await db
        .insert(statusPakan)
        .values({
          userId: userRecord.id,
          persentase,
          jarakCm,
          terakhirDiperbarui: new Date(),
        })
        .onConflictDoUpdate({
          target: statusPakan.userId,
          set: {
            persentase,
            jarakCm,
            terakhirDiperbarui: new Date(),
          },
        });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating status:", err);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  // Get Logs
  app.get("/api/logs", requireAuth, async (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (userList.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const userRecord = userList[0];

      const logsList = await db
        .select()
        .from(feedingLogs)
        .where(eq(feedingLogs.userId, userRecord.id))
        .orderBy(desc(feedingLogs.waktuEksekusi))
        .limit(100);

      res.json(logsList);
    } catch (err: any) {
      console.error("Error fetching logs:", err);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  // Add Log Entry
  app.post("/api/logs", requireAuth, async (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const userList = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      if (userList.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const userRecord = userList[0];

      const { metode, status } = req.body;
      if (!metode || !status) {
        return res.status(400).json({ error: "Missing required log fields" });
      }

      await db.insert(feedingLogs).values({
        userId: userRecord.id,
        metode,
        status,
        waktuEksekusi: new Date(),
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error inserting log:", err);
      res.status(500).json({ error: "Database query failed" });
    }
  });

  // --- Vite / Static Assets Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
