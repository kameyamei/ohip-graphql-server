// server.js - GraphQL Subscription Server for OHIP GraphiQL Tool
const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// GraphQL Schema Definition
const typeDefs = `
  type Query {
    getHelp: Help
  }

  type Subscription {
    newEvent(input: EventInput): Event
  }

  input EventInput {
    chainCode: String!
  }

  type Help {
    overview: String
    configuration: String
    connection: ConnectionHelp
    events: EventHelp
    slack: String
    email: String
  }

  type ConnectionHelp {
    help: String
    errors: String
  }

  type EventHelp {
    payload: String
    replaying: String
  }

  type Event {
    metadata: EventMetadata
    moduleName: String
    eventName: String
    detail: [EventDetail]
  }

  type EventMetadata {
    offset: String
    uniqueEventId: String
  }

  type EventDetail {
    elementName: String
    newValue: String
    oldValue: String
  }
`;

// Mock data for demonstration purposes
const generateMockEvent = (chainCode) => {
  const eventTypes = ['RESERVATION', 'PROFILE', 'AVAILABILITY', 'RATE'];
  const elementNames = ['STATUS', 'AMOUNT', 'DATE', 'NAME', 'EMAIL'];
  
  const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const randomElement = elementNames[Math.floor(Math.random() * elementNames.length)];
  
  return {
    metadata: {
      offset: Math.floor(Math.random() * 1000000).toString(),
      uniqueEventId: crypto.randomUUID()
    },
    moduleName: chainCode,
    eventName: randomEvent,
    detail: [
      {
        elementName: randomElement,
        newValue: `New-${Math.random().toString(36).substring(7)}`,
        oldValue: `Old-${Math.random().toString(36).substring(7)}`
      }
    ]
  };
};

// Resolver map
const resolvers = {
  Query: {
    getHelp: () => ({
      overview: "https://docs.oracle.com/cd/F29336_01/doc.201/f27480/c_streaming_api.htm#OHIPU-StreamingAPIpush-17008E8A",
      configuration: "https://docs.oracle.com/cd/F29336_01/doc.201/f27480/c_configuring_streaming_api.htm",
      connection: {
        help: "https://docs.oracle.com/cd/F29336_01/doc.201/f27480/t_connecting_to_the_streaming_api.htm",
        errors: "https://docs.oracle.com/cd/F29336_01/doc.201/f27480/r_troubleshooting_streaming_api.htm"
      },
      events: {
        payload: "https://docs.oracle.com/cd/F29336_01/doc.201/f27480/r_event_schema.htm",
        replaying: "https://docs.oracle.com/cd/F29336_01/doc.201/f27480/t_replaying_events.htm"
      },
      slack: "#ohip-streaming-api",
      email: "support@example.com"
    })
  },
  Subscription: {
    newEvent: {
      subscribe: async function* (_, { input }) {
        // In a real application, this would subscribe to an actual event source
        // For demo purposes, we'll just emit a new event every 5 seconds
        while (true) {
          yield { newEvent: generateMockEvent(input.chainCode) };
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  }
};

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-app-key'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || !apiKey) {
    res.status(401).json({ error: 'Unauthorized - Missing credentials' });
    return;
  }

  // For demo purposes, we're not validating the token content
  // In a real application, you would verify the token

  next();
};

// WebSocket authentication and connection handling
const validateConnection = async (ctx) => {
  const { connectionParams, extra } = ctx;
  const { request } = extra;

  // Get the socket key from URL query parameters
  const url = new URL(request.url, `http://${request.headers.host}`);
  const socketKey = url.searchParams.get('key');

  // Check for required authentication parameters
  if (!connectionParams?.Authorization || !connectionParams?.['x-app-key']) {
    return false;
  }

  // Extract the authorization token
  const authToken = connectionParams.Authorization.replace('Bearer ', '');
  const apiKey = connectionParams['x-app-key'];

  if (!authToken || !apiKey || !socketKey) {
    throw new Error('4401 Unauthorized - Invalid credentials');
  }

  // Verify that the socket key matches the SHA-256 hash of the API key
  const expectedSocketKey = crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');

  if (socketKey !== expectedSocketKey) {
    throw new Error('400 Incorrect key or URL');
  }

  // All checks passed, authorize the connection
  return true;
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Create schema from typeDefs and resolvers
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Create WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/subscriptions',
  });

  // Configure WebSocket server with graphql-ws
  const serverCleanup = useServer({
    schema,
    onConnect: validateConnection,
  }, wsServer);

  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    plugins: [
      // Proper shutdown for the HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Proper shutdown for the WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  // Start Apollo Server
  await server.start();

  // Apply middleware to handle requests
  app.use(
    '/graphql',
    cors(),
    bodyParser.json(),
    authenticate,
    expressMiddleware(server)
  );

  // Serve the static GraphiQL HTML
  app.use(express.static('public'));

  // Start the server
  const PORT = process.env.PORT || 4000;
  httpServer.listen(PORT, () => {
    console.log(`
    🚀 Server ready at http://localhost:${PORT}/graphql
    🔌 Subscriptions ready at ws://localhost:${PORT}/subscriptions
    📱 GraphiQL available at http://localhost:${PORT}/
    `);
  });
}

startServer().catch(err => {
  console.error('Error starting server:', err);
});
