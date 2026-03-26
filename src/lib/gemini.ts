// Gemini AI Integration — proxied through Lambda server
// NO API key on client — all calls go through /api/gemini/*

import { serverPost } from '@/lib/serverApi';

const getSeason = (month: number): string => {
  if (month >= 2 && month <= 5) return 'Summer (Zaid)';
  if (month >= 6 && month <= 9) return 'Monsoon (Kharif)';
  return 'Winter (Rabi)';
};

export const getAITaskRecommendations = async (
  userData: any,
  soilData: any,
  weather: any,
  ndviData?: any,
  forecast?: any
): Promise<any[]> => {
  try {
    const data = await serverPost<{ tasks: any[] }>('/api/gemini/tasks', {
      userData,
      soilData,
      weather,
      forecast,
      ndviData
    });
    return data.tasks;
  } catch (error) {
    console.error('AI task recommendations failed:', error);
    return [
      {
        title: 'Apply Organic Compost',
        description: 'Enrich soil with homemade compost or vermicompost (10 kg per acre)',
        priority: 'high',
        category: 'fertilization'
      },
      {
        title: 'Prepare Neem Spray',
        description: 'Make organic neem oil spray (30ml neem oil + 10ml soap in 1L water) for pest control',
        priority: 'high',
        category: 'pest_control'
      },
      {
        title: 'Mulch Field',
        description: 'Apply organic mulch (straw or leaves) to conserve water and suppress weeds',
        priority: 'medium',
        category: 'irrigation'
      }
    ];
  }
};

export const chatWithAI = async (message: string, context: string[]): Promise<string> => {
  try {
    const data = await serverPost<{ response: string }>('/api/gemini/chat', {
      message,
      context,
    });
    return data.response;
  } catch (error) {
    console.error('AI chat failed:', error);
    return 'I apologize, I am having trouble connecting right now. Please try again later.';
  }
};

export const predictYield = async (fieldData: any, historicalData: any): Promise<number> => {
  // Simplified prediction — in production would use proper ML model
  const baseYield = 2.5; // tons per acre
  const randomFactor = 0.8 + Math.random() * 0.4;
  return baseYield * fieldData.area * randomFactor;
};

// Video-based crop health analysis using Gemini multimodal (via server)
export const analyzeCropHealthFromVideo = async (
  videoFile: File,
  cropType: string,
  fieldName: string
): Promise<any> => {
  try {
    console.log('Starting video analysis...', {
      cropType,
      fieldName,
      fileSize: videoFile.size,
      fileType: videoFile.type
    });

    // Convert video to base64
    const base64Data = await fileToBase64(videoFile);
    // Strip data URL prefix
    const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    console.log('Sending video to server for Gemini analysis...');

    const data = await serverPost('/api/gemini/video', {
      base64Data: rawBase64,
      mimeType: videoFile.type,
      cropType,
      fieldName,
    });

    return data;
  } catch (error) {
    console.error('Video analysis failed:', error);
    throw new Error(`Failed to analyze video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Disease treatment recommendations via server
export const getDiseaseTreatment = async (
  diseases: string[],
  confidences: number[],
  cropType?: string,
  location?: { lat: number; lng: number }
): Promise<string> => {
  try {
    const data = await serverPost<{ treatment: string }>('/api/gemini/treatment', {
      diseases,
      confidences,
      cropType,
      location,
    });
    return data.treatment;
  } catch (error) {
    console.error('Disease treatment recommendation failed:', error);

    const fallbackTreatments = diseases.map(disease => {
      return `**${disease}**:\n- Apply neem oil spray (30ml neem oil + 10ml liquid soap in 1 liter water)\n- Spray early morning or evening\n- Repeat every 7-10 days\n- Remove severely infected plant parts`;
    }).join('\n\n');

    return `I apologize, I'm having trouble connecting. Here are general organic treatment recommendations:\n\n${fallbackTreatments}\n\n**General Prevention**:\n- Apply organic compost\n- Use Trichoderma-enriched compost\n- Maintain proper spacing\n- Practice crop rotation`;
  }
};
