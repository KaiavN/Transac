import { Express, Request, Response } from "express";

// Simple auth-check utility
const authCheck = (req: Request, res: Response, next: Function) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

export async function registerRoutes(app: Express) {
  app.get("/", authCheck, (req: Request, res: Response) => {
    res.json({ message: "Authenticated. Welcome!" });
  });

  app.post("/login", (req: Request, res: Response) => {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }

    req.session.user = username;
    res.json({ message: "Logged in", user: username });
  });

  app.get("/logout", (req: Request, res: Response) => {
    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: "Logout failed" });

      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/session-info", (req: Request, res: Response) => {
    res.json({
      sessionID: req.sessionID,
      sessionUser: req.session.user,
    });
  });



    fetch('/session-info', {
      method: 'GET',
      credentials: 'include', // essential to send cookies alongside request
      headers: { 'Content-Type': 'application/json' },
    })
    .then(res => res.json())
    .then(data => console.log('Session Info:', data))
    .catch(err => console.error('Error:', err));

}