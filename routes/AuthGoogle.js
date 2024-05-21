import {
  googleAuth,
  googleAuthCallback,
  googleLogout,
} from "../controllers/GoogleAuth.js";
import express from "express";
import axios from "axios";
import { Context } from "express-validator/src/context.js";

const app = express.Router();

app.get("/google", googleAuth);
app.get("/google/callback", googleAuthCallback);
app.get("/googleLogout", googleLogout);

app.get("/api/photos", async (req, res) => {
  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${"ya29.a0Ad52N3-NrUsdXr47J5raeBb-jN7bys2siyn29icQu6FDFHgnjzzypIkQU9zzyem7RCa9QGI7Fg7AqQrWoN3yydmVzTr3jHbrWSCPM0JOAEeqvW2pz_mmPeqLGnlJZCL-e9w6-QUnM1OuhUu3vZwPjz_3if5kp8XFv3rKaCgYKASoSARASFQHGX2MivS8bYIkj-sdTe0xO0p0pRQ0171"}`,
    };
    const params = {
      pageSize: "100",
    };

    const response = await axios.get(
      "https://photoslibrary.googleapis.com/v1/mediaItems",
      {
        headers,
        params,
      }
    );

    const photos = response.data.mediaItems;

    // console.log(photos);

    res.json({ photos });
  } catch (error) {
    console.error("Error fetching Google Photos:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default app;
