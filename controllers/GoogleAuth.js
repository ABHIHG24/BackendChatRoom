import passport from "passport";

const googleAuth = passport.authenticate("google", {
  scope: [
    "profile",
    "email",
    "hhttps://www.googleapis.com/auth/photoslibrary.readonly",
  ],
});

const googleAuthCallback = passport.authenticate("google", {
  successRedirect: "http://localhost:5173",
  failureRedirect: "http://localhost:5173/login",
});

const googleLogout = (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("http://localhost:5173");
  });
};

export { googleLogout, googleAuthCallback, googleAuth };
