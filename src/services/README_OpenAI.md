# OpenAI Integration Services

This directory contains the OpenAI API integration services for LLM-powered puzzle generation.

## Services

### 1. OpenAI Service (`openaiService.js`)
- **Purpose**: Core OpenAI API client with authentication and error handling
- **Features**:
  - Environment variable handling for API key (`VITE_OPENAI_API_KEY`)
  - 30-second timeout for API requests
  - Comprehensive error handling for different HTTP status codes (401, 429, 500)
  - Secure API key management (not logged to console)
  - Connection testing functionality

### 2. Prompt Builder (`promptBuilder.js`)
- **Purpose**: Constructs structured prompts for puzzle generation
- **Features**:
  - Base prompt template with format specification and rules
  - Difficulty level customization (easy, medium, hard)
  - Proof type emphasis (big-o, induction, set-theory, etc.)
  - Input validation and normalization
  - Label mapping from display names to internal identifiers

### 3. Puzzle Generator (`puzzleGenerator.js`)
- **Purpose**: Orchestrates puzzle generation using OpenAI API and prompt building
- **Features**:
  - Complete puzzle generation workflow
  - Response parsing and validation
  - Puzzle structure validation (8-12 blocks, required properties)
  - Metadata addition (ID, timestamps, source tracking)
  - Comprehensive error handling and validation

## Environment Configuration

Create a `.env` file in the project root with:
```
VITE_OPENAI_API_KEY=your_api_key_here
```

## Usage Example

```javascript
import puzzleGenerator from './services/puzzleGenerator.js';

const userSelections = {
  difficulty: 'medium',
  proofTypes: ['induction', 'big-o'],
  additionalTags: ['mathematical']
};

try {
  const puzzle = await puzzleGenerator.generatePuzzle(userSelections);
  console.log('Generated puzzle:', puzzle);
} catch (error) {
  console.error('Generation failed:', error.message);
}
```

## Error Handling

All services implement comprehensive error handling:
- **Configuration errors**: Missing API key
- **Network errors**: Connection failures, timeouts
- **API errors**: Authentication failures, rate limits, server errors
- **Validation errors**: Invalid puzzle structure, missing required fields

## Testing

Run the integration test:
```bash
node src/test/openaiIntegrationTest.js
```

This tests all services without requiring an actual API key, verifying error handling and structure validation.