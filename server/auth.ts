import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { IUser } from "../shared/mongodb-schema";
import { mongoStorage } from "./mongodb-storage";

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error("SESSION_SECRET is required");

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL is required");
  
  const store = MongoStore.create({ 
    mongoUrl,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60
  });

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    store,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ 
      usernameField: 'email',
      passwordField: 'password'
    }, 
    async (email, password, done) => {
      try {
        console.log('Login attempt:', { email });
        const user = await mongoStorage.getUserByUsername(email);
        
        if (!user) {
          console.log('User not found:', email);
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Compare password: in Mongo backend, storage hashes; in memory, plain text
        let isValid = false;
        try {
          if (typeof mongoStorage.comparePasswords === 'function') {
          isValid = await mongoStorage.comparePasswords(password, user.password);
        } else {
          isValid = password === user.password;
        }
        } catch (_) {
          isValid = password === user.password;
        }
        console.log('Password valid:', isValid);

        if (!isValid) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        console.error('Login error:', error);
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await mongoStorage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await mongoStorage.getUserByUsername(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Create user with hashed password
      const user = await mongoStorage.createUser({
        ...req.body,
        username: req.body.email, // Ensure username is set to email
        password: req.body.password // Will be hashed in the storage layer
      });

      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send password hash back to client
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log('Login request body:', req.body);
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        console.error('Authentication error:', err);
        return next(err);
      }
      if (!user) {
        console.log('Authentication failed:', info?.message);
        return res.status(401).json({ message: info?.message || 'Authentication failed' });
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return next(err);
        }
        console.log('Login successful for user:', user.email);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Don't send password hash to client
    if (req.user) {
      const { password, ...userWithoutPassword } = req.user as any;
      return res.json(userWithoutPassword);
    }
    res.sendStatus(401);
  });
}

