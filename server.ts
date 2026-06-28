import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and Urlencoded body parsing with 50mb limit (required to support large vehicle image data)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API health route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Secure Server-Side Sync proxy route
  app.post("/api/sync", async (req, res) => {
    const { syncUrl, syncKey, localUsers, unsyncedJobs, localLogs, deletedJobIds } = req.body;
    if (!syncUrl || !syncKey) {
      return res.status(400).json({ success: false, error: "Sync URL or Key is missing." });
    }

    try {
      const supabase = createClient(syncUrl, syncKey, {
        auth: {
          persistSession: false
        }
      });

      // 0.5 DELETE REMOVED JOB CARDS FROM CLOUD
      if (deletedJobIds && deletedJobIds.length > 0) {
        const { error: delErr } = await supabase
          .from("job_cards")
          .delete()
          .in("id", deletedJobIds);
        if (delErr) {
          console.warn("Supabase delete error:", delErr.message);
        }
      }

      // 1. SYNC USERS TABLE (Upload local staff list or register)
      if (localUsers && localUsers.length > 0) {
        let { error: userError } = await supabase
          .from("users")
          .upsert(
            localUsers.map((u: any) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              phone_number: u.phoneNumber,
              garage_name: u.garageName,
              role: u.role,
              category: u.category || null,
              logo_url: u.logoUrl || null,
              banner_url: u.bannerUrl || null,
              created_at: u.createdAt
            }))
          );

        // Fallback for compatibility if custom columns are missing in remote schema
        if (userError && (userError.message.includes("column") || userError.message.includes("logo_url") || userError.message.includes("banner_url"))) {
          console.log("Retrying user upsert without custom logo/banner columns for compatibility...");
          const { error: retryError } = await supabase
            .from("users")
            .upsert(
              localUsers.map((u: any) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                phone_number: u.phoneNumber,
                garage_name: u.garageName,
                role: u.role,
                category: u.category || null,
                created_at: u.createdAt
              }))
            );
          userError = retryError;
        }

        if (userError) {
          console.warn("Supabase user upsert warning/error:", userError.message);
          const msg = userError.message || "";
          if (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("relation")) {
            throw new Error("Supabase database setup is incomplete! Please go to Sync & Settings and run the 'Table Schema Setup' SQL script in your Supabase SQL Editor.");
          }
        }
      }

      // 2. PUSH OFFLINE JOB CARDS
      const pushedIds: string[] = [];
      if (unsyncedJobs && unsyncedJobs.length > 0) {
        for (const job of unsyncedJobs) {
          const { error: pushErr } = await supabase
            .from("job_cards")
            .upsert({
              id: job.id,
              jb_number: job.jbNumber,
              vehicle_number: job.vehicleNumber,
              name: job.name,
              phone_number: job.phoneNumber,
              work_rows: job.workRows,
              total_cost: job.totalCost,
              sms_sent: job.smsSent,
              sms_text: job.smsText,
              status: job.status,
              vehicle_photo: job.vehiclePhoto,
              created_by: job.createdBy,
              created_by_id: job.createdById,
              created_at: job.createdAt,
              updated_at: job.updatedAt
            });

          if (!pushErr) {
            pushedIds.push(job.id);
          } else {
            const msg = pushErr.message || "";
            if (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("relation")) {
              throw new Error("Supabase database setup is incomplete! Please go to Sync & Settings and run the 'Table Schema Setup' SQL script in your Supabase SQL Editor to create the 'job_cards' table.");
            }
            throw new Error(`Failed to push JB number ${job.jbNumber}: ${pushErr.message}`);
          }
        }
      }

      // 3. PUSH MESSAGE LOGS
      if (localLogs && localLogs.length > 0) {
        const { error: logErr } = await supabase
          .from("message_logs")
          .upsert(
            localLogs.map((l: any) => ({
              id: l.id,
              jb_number: l.jbNumber,
              vehicle_number: l.vehicleNumber,
              phone_number: l.phoneNumber,
              recipient_name: l.recipientName,
              message: l.message,
              timestamp: l.timestamp,
              status: l.status
            }))
          );
        if (logErr) {
          console.warn("Supabase logs sync warning:", logErr.message);
          const msg = logErr.message || "";
          if (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("relation")) {
            throw new Error("Supabase database setup is incomplete! Please go to Sync & Settings and run the 'Table Schema Setup' SQL script in your Supabase SQL Editor to create the 'message_logs' table.");
          }
        }
      }

      // 4. PULL REMOTE JOB CARDS
      const { data: remoteJobs, error: pullErr } = await supabase
        .from("job_cards")
        .select("*");

      if (pullErr) {
        const msg = pullErr.message || "";
        if (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("relation")) {
          throw new Error("Supabase database setup is incomplete! Please go to Sync & Settings and run the 'Table Schema Setup' SQL script in your Supabase SQL Editor to create the 'job_cards' table.");
        }
        throw new Error(`Failed to fetch job cards: ${pullErr.message}`);
      }

      // 5. PULL REMOTE USERS (to fetch staff added from other devices)
      let remoteUsers: any[] = [];
      const { data: usersPullData, error: usersPullErr } = await supabase
        .from("users")
        .select("*");

      if (!usersPullErr && usersPullData) {
        remoteUsers = usersPullData;
      }

      res.json({
        success: true,
        pushedIds,
        remoteJobs,
        remoteUsers
      });
    } catch (err: any) {
      console.error("Server sync error:", err);
      res.status(500).json({ success: false, error: err.message || "Server sync failed" });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
