if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const initializePassport = require("./passport");
initializePassport(
  (username) => users.find((user) => user.username === username),
  (id) => users.find((user) => user.id === id)
);

// Set The Storage Engine
const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// Init Upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 },
}).single("myFile");

let users;
fs.readFile("./db.json", (err, data) => {
  if (err) console.log(err);
  users = JSON.parse(data);
});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
app.use(express.static("./public"));

// Routes
app.get("/", checkAuthenticated, (req, res) => {
  let user = users.find((user) => user.username === req.user.username);
  res.render("index.ejs", { user: user });
});
app.post("/", checkAuthenticated, (req, res) => {
  let user = users.find((user) => user.username === req.user.username);
  upload(req, res, (err) => {
    if (err) {
      res.render("index", {
        user: user,
        msg: err,
      });
    } else {
      if (req.file == undefined) {
        res.render("index", {
          user: user,
          msg: "Error: No File Selected!",
        });
      } else {
        for (let i = 0; i < users.length; i++) {
          if (users[i].username == req.user.username) {
            users[i].files[req.query.tab].push(req.file.filename);
          }
        }
        fs.writeFile("./db.json", JSON.stringify(users, null, "\t"), (err) => {
          if (err) console.log(err);
        });
        res.render("index", {
          user: user,
          msg: "File Uploaded!",
          file: `uploads/${req.file.filename}`,
        });
      }
    }
  });
});
app.get("/download/:id", checkAuthenticated, (req, res) => {
  let user = users.find((user) => user.username === req.user.username);
  let file =
    user.files.syllabus.find((file) => file == req.params.id) || user.files.notice.find((file) => file == req.params.id) ||
    user.files.invoice.find((file) => file == req.params.id);
  var x = __dirname + "/public/uploads/" + file;
  res.download(x);
});

app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});
app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});
app.post("/register", checkNotAuthenticated, async (req, res) => {
  if (typeof users.find((user) => user.username == req.body.username) != 'undefined') {
    return res.redirect("/register");
  }
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    users.push({
      id: Date.now().toString(),
      username: req.body.username,
      password: hashedPassword,
      name: "",
      description: "",
      files: {
        syllabus: [],
        notice: [],
        invoice: [],
      },
    });
    fs.writeFile("./db.json", JSON.stringify(users, null, "\t"), (err) => {
      if (err) console.log(err);
    });
    res.redirect("/login");
  } catch {
    res.redirect("/register");
  }
});

app.delete("/logout", (req, res) => {
  req.logOut();
  res.redirect("/login");
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at port: ${PORT}`);
});
