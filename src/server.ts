import { config } from "./config.js";
import { createApp } from "./app.js";
import { createStore } from "./database/inMemoryStore.js";

const store = createStore();
const { httpServer } = await createApp(store, config);

httpServer.listen(config.PORT, () => {
  console.log(`GraphQL API listening on http://localhost:${config.PORT}/graphql`);
});
