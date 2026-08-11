// requireAuth.js
// -------------------------------------------------------
// This is a MIDDLEWARE function — it runs between the
// incoming request and the route handler.
//
// Think of it as a security guard at the door:
//   - If you have a session (you're logged in) → let you in (next())
//   - If you don't → redirect you to the login page
// -------------------------------------------------------

export default function requireAuth(req, res, next) {

    if (req.session && req.session.isAdmin) {
        // ✅ User is logged in — pass the request to the actual route
        next();
    } else {
        // ❌ User is NOT logged in — send them to the login page
        res.redirect("/login");
    }

}
