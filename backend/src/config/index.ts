// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

// Define event types
export enum EventType {
  MEAL = 'meal',
  POTLUCK = 'potluck',
  DRINKS = 'drinks',
  ACTIVITY = 'activity',
  CELEBRATION = 'celebration',
  PROFESSIONAL = 'professional',
  OTHER = 'other',
}

export const config = {
  app: {
    name: 'ConnectSphere',
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    prefix: 'connectsphere:',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/connectsphere',
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || 'noreply@connectsphere.com',
    fromName: process.env.FROM_NAME || 'ConnectSphere',
  },
  maps: {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    defaultZoom: 15,
  },
  calendar: {
    icsAppName: 'ConnectSphere',
    icsOrganizerEmail: 'calendar@connectsphere.com',
  },
  dietary: {
    patterns: [
      { id: 'omnivore', label: 'No restrictions (I eat everything)' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'pescatarian', label: 'Pescatarian (vegetarian + seafood)' },
      { id: 'flexitarian', label: 'Flexitarian (mostly plant-based)' },
    ],
    religious: [
      { id: 'halal', label: 'Halal' },
      { id: 'kosher', label: 'Kosher' },
      { id: 'hindu', label: 'No beef' },
      { id: 'jain', label: 'Jain diet' },
    ],
    allergies: [
      { id: 'gluten', label: 'Gluten-free' },
      { id: 'dairy', label: 'Dairy-free' },
      { id: 'nuts', label: 'No nuts' },
      { id: 'peanuts', label: 'No peanuts' },
      { id: 'shellfish', label: 'No shellfish' },
      { id: 'eggs', label: 'No eggs' },
      { id: 'soy', label: 'No soy' },
      { id: 'fish', label: 'No fish' },
    ],
    lifestyle: [
      { id: 'organic', label: 'Prefer organic' },
      { id: 'local', label: 'Prefer locally-sourced' },
      { id: 'lowcarb', label: 'Low carb' },
      { id: 'keto', label: 'Keto' },
      { id: 'paleo', label: 'Paleo' },
      { id: 'whole30', label: 'Whole30' },
    ],
    intensity: [
      { id: 'mild', label: 'Mild food (not spicy)' },
      { id: 'spicy', label: 'Enjoy spicy food' },
    ],
    alcohol: [
      { id: 'no-alcohol', label: "Don't drink alcohol" },
      { id: 'alcohol-ok', label: 'Drink alcohol' },
    ],
  },
};

// Helper function to determine which dietary sections to show based on event type
export function getDietarySectionsForEventType(eventType: EventType) {
  switch (eventType) {
    case EventType.MEAL:
      return ['patterns', 'religious', 'allergies', 'intensity'];
    case EventType.POTLUCK:
      return ['patterns', 'religious', 'allergies'];
    case EventType.DRINKS:
      return ['alcohol'];
    case EventType.CELEBRATION:
      return ['patterns', 'allergies', 'alcohol'];
    case EventType.PROFESSIONAL:
      return ['patterns', 'allergies'];
    default:
      return ['allergies']; // Always show allergies as minimum
  }
}

export default config;
