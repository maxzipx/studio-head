# Studio Head 🎬

A cross-platform film studio management simulation game built with React Native and Expo. Manage your entertainment empire, develop scripts, scout talent, produce films, and navigate the unpredictable entertainment industry.

**Platform Support:** iOS • Android • Web

## Overview

Studio Head is a strategy simulation game where you take the role of a film studio executive. Balance creative ambitions with financial realities as you develop scripts, manage talent, produce films, handle distribution, and grow your studio into a powerhouse.

### Key Features

- **Studio Management**: Build and expand your film studio with strategic decisions
- **Script Development**: Acquire scripts, manage the development process, and track progress
- **Talent Management**: Scout, sign, and manage actors and crew for your productions
- **Production Pipeline**: Produce films, manage budgets, and track box office performance
- **Financial System**: Track revenue, manage expenses, and maintain studio profitability
- **Distribution Strategy**: Plan film releases and distribution strategies across platforms
- **Dynamic Events**: Face random events that challenge your decision-making
- **Game Progression**: Long-run balance tracking and studio metrics
- **Cross-Platform**: Play on iOS, Android, or Web with synchronized game state

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Expo CLI** (installed globally: `npm install -g expo-cli`)
- For iOS: macOS with Xcode
- For Android: Android Studio emulator or device
- For Web: Modern web browser

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/studio-head.git
   cd studio-head
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

4. Choose your platform:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Press `w` for Web
   - Scan QR code with Expo Go app on physical device

### Development

This project uses [file-based routing](https://docs.expo.dev/router/introduction/) via Expo Router. Edit files in the **app** directory to update screens and navigation.

**Quick Development Workflow:**
```bash
npm run dev          # Start development server
npm test             # Run test suite with Vitest
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript types
```

## Project Structure

```
studio-head/
├── app/                          # Expo Router file-based routing
│   ├── (tabs)/                   # Main tab navigation screens
│   │   ├── box-office/           # Box office analytics
│   │   ├── distribution/         # Distribution strategy
│   │   ├── explore/              # Studio discovery
│   │   ├── financials/           # Financial overview
│   │   ├── inbox/                # Messages and notifications
│   │   ├── script-room/          # Script management
│   │   ├── slate/                # Film production slate
│   │   └── talent/               # Talent management
│   └── project/                  # Dynamic project detail pages
│
├── src/                          # Core application logic
│   ├── domain/                   # Game/business logic
│   │   ├── services/             # Studio manager, event system
│   │   ├── event-deck/           # Event generation and handling
│   │   ├── formulas/             # Game balance and calculations
│   │   ├── types/                # Domain type definitions
│   │   └── data/                 # Game data and constants
│   │
│   ├── state/                    # Game state management (Zustand)
│   │   ├── game-store.ts         # Main game state store
│   │   ├── selectors/            # State selectors and queries
│   │   └── persistence/          # Save/load game state
│   │
│   └── ui/                       # UI-specific helpers and components
│       ├── components/           # Custom UI components
│       ├── hq/                   # HQ screen components
│       ├── project/              # Project detail components
│       └── helpers/              # UI utility functions
│
├── components/                   # Reusable React Native components
│   ├── ui/                       # UI primitives and utilities
│   └── ThemedText.tsx, ThemedView.tsx
│
├── hooks/                        # Custom React hooks
│   └── useColorScheme.ts, useTheme.ts
│
├── constants/                    # App-wide constants
│   └── Colors.ts
│
├── assets/                       # Images and media
├── scripts/                      # Build and setup scripts
├── package.json
├── tsconfig.json
├── eas.json                      # EAS build configuration
└── app.json                      # Expo app configuration
```

## Technology Stack

- **Framework**: [React Native](https://reactnative.dev) / [Expo](https://expo.dev)
- **Language**: [TypeScript](https://www.typescriptlang.org)
- **Routing**: [Expo Router](https://expo.github.io/router)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Testing**: [Vitest](https://vitest.dev)
- **Linting**: [ESLint](https://eslint.org)
- **Build**: [EAS Build](https://docs.expo.dev/build/introduction/)

## Game Architecture

### Domain Layer (`/src/domain`)

Contains pure game logic independent of UI:
- **Studio Manager**: Core business logic for studio operations
- **Event System**: Dynamic event generation and impact calculation
- **Formulas**: Game balance equations and calculations
- **Services**: Talent, finance, and content validation services

### State Layer (`/src/state`)

Manages game state using Zustand:
- Centralized game store with typed selectors
- Automatic persistence to device storage
- Efficient state queries and subscriptions

### UI Layer (`/src/ui` and `/components`)

Reusable components and helpers:
- Theme-aware UI components
- Screen-specific component collections
- Helper utilities for common UI tasks

## Testing

The project includes comprehensive tests for core game logic:

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

**Test Coverage:**
- Domain logic (formulas, services, event system)
- State management (store, selectors, persistence)
- UI helpers and calculations

## Building for Release

### iOS and Android (via EAS)

```bash
# Configure your EAS project
eas build --platform ios
eas build --platform android

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

For detailed instructions, see [EAS Documentation](https://docs.expo.dev/build/introduction/).

### Web

```bash
npm run build
# Distribution files in dist/
```

## Game Design Philosophy

Studio Head simulates the complexity of film studio management:

- **Dynamic Systems**: Interconnected mechanics (talent affects quality, quality affects box office, etc.)
- **Risk & Reward**: Strategic decisions have both immediate and long-term impacts
- **Realism**: Game formulas reflect real industry dynamics
- **Accessibility**: Complex systems presented through intuitive UI

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the existing code style and TypeScript conventions
4. Add tests for new logic
5. Commit with clear messages
6. Push to your branch
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## Support

For issues, questions, or feature requests, please open an [issue on GitHub](https://github.com/yourusername/studio-head/issues).

---

**Happy managing! 🎬✨**
