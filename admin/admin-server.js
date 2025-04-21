const express = require("express");
const path = require("path");
const cors = require("cors");
const db = require("./db.js");

const app = express();
const PORT = 9000;

app.use(express.static(path.join(__dirname)));

app.use(cors());
app.use(express.json());


// ✅ API to get user statistics
app.get("/admin/stats", async (req, res) => {
  try {
    
    // Execute queries in parallel for better performance
    const [[stats]] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM listeners WHERE listener_status='active') AS activeUsers,
        (SELECT COUNT(*) FROM meetings WHERE flag = 1) AS ongoingSessions,
        (SELECT ROUND(AVG(call_duration)) FROM meetings) AS avgDuration
    `);
      
    // Dummy values for fields not in DB
     // Keep it as a number (minutes)
    const onlineUsers = Math.floor(Math.random() * 150) + 50;
    const liveSessions = Math.floor(Math.random() * 50) + 10;

    const responseData = {
      totalUsers: stats.totalUsers,
      activeUsers: stats.activeUsers,
      ongoingSessions: stats.ongoingSessions,
      avgDuration: stats.avgDuration || 0, // Number of minutes
      onlineUsers,
      liveSessions,
    };

    res.json({ success: true, data: responseData });

  } catch (error) {
    console.error("❌ Database error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});
//-----------------------------------------users management--------------------------------------------------------------------------------//
// API to get user details from the database
app.get("/admin/users", async (req, res) => {
   try {
    const [users] = await db.query(`
      SELECT 
        u_username AS username, 
        u_email AS email, 
        u_mobile_no AS mobile, 
        ban,
        suspend
      FROM users
    `);
       res.json({ success: true, data: users });
  } catch (error) {
    
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});
//-----------------users-ban..................//
// API to ban/unban a user
app.put("/admin/users/:username/ban", async (req, res) => {
  try {
    const { username } = req.params;

    // Get the current ban status
    const [user] = await db.query("SELECT ban FROM users WHERE u_username = ?", [username]);

    if (!user.length) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    // Toggle ban status (0 -> 1, 1 -> 0)
    const newBanStatus = user[0].ban ? 0 : 1;
    await db.query("UPDATE users SET ban = ? WHERE u_username = ?", [newBanStatus, username]);

    res.json({
      success: true,
      message: `User ${username} has been ${newBanStatus ? "banned" : "unbanned"}.`,
      ban: newBanStatus,
    });

  } catch (error) {
    console.error(" Database error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});
//----------------------------------------------------suspend------------------------------------//
app.put("/admin/users/:username/suspend", async (req, res) => {
  try {
      const { username } = req.params;
      const { days } = req.body;

      console.log("Incoming suspend request:", { username, days }); // Debugging log

      if (!days || isNaN(days) || days <= 0) {
          return res.status(400).json({ success: false, error: "Invalid suspension period." });
      }

      const query = `
          UPDATE users 
          SET suspended_time = NOW(), 
              suspended_days = ?, 
              suspend = 1 
          WHERE u_username = ?
      `;
      
      const [result] = await db.query(query, [days, username]);

      console.log("SQL Update Result:", result); 

      if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, error: "User not found." });
      }

      res.json({ success: true, message: `${username} suspended for ${days} days.` });

  } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});
// Reactivate users whose suspension period has ended
setInterval(async () => {
  try {
    const [result] = await db.query(`
      UPDATE users 
      SET suspend = 0, suspended_time = NULL, suspended_days = 0
      WHERE suspend = 1 
        AND NOW() >= DATE_ADD(suspended_time, INTERVAL suspended_days DAY)
    `);

    if (result.changedRows > 0) {
      
    }
  } catch (err) {
    console.error("❌ Suspension auto-clear failed:", err);
  }
}, 60 * 60 * 1000); // Runs every hour (adjust as needed)



//------------------------------------------------------------listeners------------------------------------------------//
app.get("/admin/listeners", async (req, res) => {
  try {
    const [listeners] = await db.query("SELECT username AS name FROM listeners");

    res.json({ success: true, listeners });
  } catch (error) {
    console.error("Error fetching listeners:", error);
    res.status(500).json({ success: false, error: "Database Error" });
  }
});
//------------------------------------------------sessionmonitoring----------------------------------------------------------------------//
app.get("/admin/sessions", async (req, res) => {
  try {
    const query = `SELECT 
          m.meet_id AS id,
          m.caller_name AS username,
          m.call_duration AS duration,
          l.username AS activename
          FROM meetings m JOIN listeners l
          ON m.active_listener_id = l.active_listener_id;   
        `;

      const [sessions] = await db.query(query);
      
      res.json({ success: true, data: sessions });

  } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});



// ✅ Root Route
app.get("/", (req, res) => {
  res.redirect("./login.html");
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});
