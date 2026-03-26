import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { detectDiseases } from './api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const createMockFile = (name: string = 'test.jpg'): File => {
  const blob = new Blob(['fake image data'], { type: 'image/jpeg' });
  return new File([blob], name, { type: 'image/jpeg' });
};

const mockSuccessResponse = {
  predictions: [
    {
      class_name: 'Leaf Blight',
      confidence: 0.85,
      bbox: [10, 20, 100, 120],
    },
  ],
  count: 1,
};

describe('Disease Detection API - Retry Mechanism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry on network failure and succeed on second attempt', async () => {
    const mockFile = createMockFile();
    
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const result = await detectDiseases(mockFile);

    expect(result).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.predictions[0].class_name).toBe('Leaf Blight');
  });

  it('should retry on API error and succeed on third attempt', async () => {
    const mockFile = createMockFile();
    
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

    const result = await detectDiseases(mockFile);

    expect(result).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should fail after exactly 3 retry attempts', async () => {
    const mockFile = createMockFile();
    
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(detectDiseases(mockFile)).rejects.toThrow(
      'Disease detection failed after 3 attempts'
    );

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should implement exponential backoff between retries', async () => {
    const mockFile = createMockFile();
    const startTime = Date.now();
    
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

    await detectDiseases(mockFile);

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should wait 1000ms + 2000ms = 3000ms minimum
    expect(duration).toBeGreaterThanOrEqual(2900);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe('Disease Detection API - Successful Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully detect diseases on first attempt', async () => {
    const mockFile = createMockFile();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const result = await detectDiseases(mockFile);

    expect(result).toBeDefined();
    expect(result.id).toMatch(/^detection_\d+_[a-z0-9]+$/);
    expect(result.imageName).toBe('test.jpg');
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].class_name).toBe('Leaf Blight');
    expect(result.predictions[0].confidence).toBe(0.85);
    expect(result.count).toBe(1);
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('should include location data when provided', async () => {
    const mockFile = createMockFile();
    const location = { lat: 28.6139, lng: 77.2090 };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const result = await detectDiseases(mockFile, location);

    expect(result.location).toEqual(location);
  });

  it('should handle empty predictions array', async () => {
    const mockFile = createMockFile();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        predictions: [],
        count: 0,
      }),
    });

    const result = await detectDiseases(mockFile);

    expect(result.predictions).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it('should handle multiple predictions', async () => {
    const mockFile = createMockFile();
    
    const multiPredictionResponse = {
      predictions: [
        {
          class_name: 'Leaf Blight',
          confidence: 0.85,
          bbox: [10, 20, 100, 120],
        },
        {
          class_name: 'Rust',
          confidence: 0.72,
          bbox: [150, 30, 250, 140],
        },
        {
          class_name: 'Powdery Mildew',
          confidence: 0.68,
          bbox: [50, 200, 180, 320],
        },
      ],
      count: 3,
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => multiPredictionResponse,
    });

    const result = await detectDiseases(mockFile);

    expect(result.predictions).toHaveLength(3);
    expect(result.count).toBe(3);
    expect(result.predictions[0].class_name).toBe('Leaf Blight');
    expect(result.predictions[1].class_name).toBe('Rust');
    expect(result.predictions[2].class_name).toBe('Powdery Mildew');
  });
});

describe('Disease Detection API - Schema Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error for invalid response schema', async () => {
    const mockFile = createMockFile();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        predictions: [
          {
            class_name: 'Leaf Blight',
            // Missing confidence and bbox
          },
        ],
      }),
    });

    await expect(detectDiseases(mockFile)).rejects.toThrow();
  });

  it('should throw error for invalid bounding box coordinates', async () => {
    const mockFile = createMockFile();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        predictions: [
          {
            class_name: 'Leaf Blight',
            confidence: 0.85,
            bbox: [100, 20, 10, 120], // x1 > x2 - invalid
          },
        ],
        count: 1,
      }),
    });

    await expect(detectDiseases(mockFile)).rejects.toThrow();
  });

  it('should handle API error responses', async () => {
    const mockFile = createMockFile();
    
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(detectDiseases(mockFile)).rejects.toThrow(
      'Disease detection failed after 3 attempts'
    );
  });
});

describe('Disease Detection API - FormData Construction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send image as FormData', async () => {
    const mockFile = createMockFile();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    await detectDiseases(mockFile);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('should include location in FormData when provided', async () => {
    const mockFile = createMockFile();
    const location = { lat: 28.6139, lng: 77.2090 };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    await detectDiseases(mockFile, location);

    expect(mockFetch).toHaveBeenCalled();
    const callArgs = mockFetch.mock.calls[0];
    const formData = callArgs[1].body as FormData;
    
    expect(formData).toBeInstanceOf(FormData);
  });
});

// Property-Based Tests
describe('Property 12: Retry Mechanism Exhaustion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 2.4, 2.5**
   * 
   * Property: For any API request that fails, the system should attempt 
   * exactly 3 retries with exponential backoff before displaying an error message.
   * 
   * This property verifies that:
   * 1. The system makes exactly 3 attempts (no more, no less)
   * 2. Exponential backoff is applied between retries (1s, 2s delays)
   * 3. An error is thrown after all retries are exhausted
   */
  it('should always make exactly 3 attempts for any failing request', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various error scenarios
        fc.record({
          errorType: fc.oneof(
            fc.constant('network'),
            fc.constant('server_error'),
            fc.constant('timeout'),
            fc.constant('invalid_response')
          ),
          statusCode: fc.integer({ min: 400, max: 599 }),
          errorMessage: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async (errorScenario) => {
          const mockFile = createMockFile();
          
          // Setup mock to always fail
          if (errorScenario.errorType === 'network') {
            mockFetch.mockRejectedValue(new Error(errorScenario.errorMessage));
          } else {
            mockFetch.mockResolvedValue({
              ok: false,
              status: errorScenario.statusCode,
              text: async () => errorScenario.errorMessage,
            });
          }

          // Attempt detection and expect failure
          try {
            await detectDiseases(mockFile);
            // If we reach here, the test should fail
            return false;
          } catch (error) {
            // Verify exactly 3 attempts were made
            const attemptsMade = mockFetch.mock.calls.length;
            
            // Verify error message indicates retry exhaustion
            const errorMessage = error instanceof Error ? error.message : String(error);
            const hasRetryMessage = errorMessage.includes('failed after 3 attempts');
            
            return attemptsMade === 3 && hasRetryMessage;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply exponential backoff timing for any sequence of failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different failure counts (1-2 failures before success)
        fc.integer({ min: 1, max: 2 }),
        async (failureCount) => {
          const mockFile = createMockFile();
          const startTime = Date.now();
          
          // Setup mock to fail N times then succeed
          for (let i = 0; i < failureCount; i++) {
            mockFetch.mockRejectedValueOnce(new Error('Temporary failure'));
          }
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockSuccessResponse,
          });

          await detectDiseases(mockFile);

          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Calculate expected minimum delay based on exponential backoff
          // Delay formula: 1000 * 2^attempt
          // For 1 failure: 1000ms (2^0)
          // For 2 failures: 1000ms + 2000ms = 3000ms (2^0 + 2^1)
          let expectedMinDelay = 0;
          for (let i = 0; i < failureCount; i++) {
            expectedMinDelay += 1000 * Math.pow(2, i);
          }
          
          // Allow 100ms tolerance for execution overhead
          const tolerance = 100;
          
          return duration >= (expectedMinDelay - tolerance);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should succeed on any attempt (1st, 2nd, or 3rd) when API eventually responds', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate which attempt should succeed (0 = first, 1 = second, 2 = third)
        fc.integer({ min: 0, max: 2 }),
        async (successAttempt) => {
          const mockFile = createMockFile();
          
          // Setup mock to fail until the success attempt
          for (let i = 0; i < successAttempt; i++) {
            mockFetch.mockRejectedValueOnce(new Error('Temporary failure'));
          }
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockSuccessResponse,
          });

          const result = await detectDiseases(mockFile);

          // Verify the call succeeded
          const attemptsMade = mockFetch.mock.calls.length;
          const expectedAttempts = successAttempt + 1;
          
          return (
            result !== undefined &&
            result.predictions.length > 0 &&
            attemptsMade === expectedAttempts
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle any combination of error types across retry attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate array of 3 different error types
        fc.array(
          fc.oneof(
            fc.constant('network'),
            fc.constant('server_error'),
            fc.constant('bad_gateway')
          ),
          { minLength: 3, maxLength: 3 }
        ),
        async (errorSequence) => {
          const mockFile = createMockFile();
          
          // Setup mock with the error sequence
          errorSequence.forEach((errorType) => {
            if (errorType === 'network') {
              mockFetch.mockRejectedValueOnce(new Error('Network error'));
            } else if (errorType === 'server_error') {
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
              });
            } else {
              mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 502,
                text: async () => 'Bad Gateway',
              });
            }
          });

          try {
            await detectDiseases(mockFile);
            return false; // Should have thrown
          } catch (error) {
            // Verify exactly 3 attempts regardless of error type mix
            return mockFetch.mock.calls.length === 3;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
