const corsOptions = {
  // origin: [
  //   "http://localhost:5173",
  //   "http://localhost:4173",
  //   process.env.CLIENT_URL,
  // ],
  origin: true,

  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

const CHATROOM_TOKEN = "chatroom-token";

export { corsOptions, CHATROOM_TOKEN };
