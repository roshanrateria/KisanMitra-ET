// Local storage utilities for user data (JSON-based storage)

export interface Field {
  id: string;
  name: string;
  crop: string;
  coordinates: [number, number][];
  soilType: string;
  area: number; // in acres
  soilData?: any;
  polygonId?: string;
  ndviData?: any;
}

export interface UserData {
  userId: string;
  name: string;
  phone: string;
  language: string;
  fields: Field[];
  financialRecords: FinancialRecord[];
  tasks: FarmerTask[];
  preferences: {
    notifications: boolean;
    units: 'metric' | 'imperial';
  };
}

export interface FinancialRecord {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  fieldId?: string;
}

export interface FarmerTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  timing?: string;
  done: boolean;
  createdAt: string;
  source: 'ai' | 'manual' | 'irrigation' | 'weather';
}

const STORAGE_KEY = 'kisanmitra_user_data';

export const getUserData = (userId: string): UserData | null => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading user data:', error);
    return null;
  }
};

export const saveUserData = (data: UserData): boolean => {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${data.userId}`, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving user data:', error);
    return false;
  }
};

export const initializeUserData = (userId: string, name: string, language: string = 'en'): UserData => {
  const initialData: UserData = {
    userId,
    name,
    phone: '',
    language,
    fields: [],
    financialRecords: [],
    tasks: [],
    preferences: {
      notifications: true,
      units: 'metric'
    }
  };
  saveUserData(initialData);
  return initialData;
};

export const updateUserField = (userId: string, field: Field): boolean => {
  const userData = getUserData(userId);
  if (!userData) return false;

  const existingIndex = userData.fields.findIndex(f => f.id === field.id);
  if (existingIndex >= 0) {
    userData.fields[existingIndex] = field;
  } else {
    userData.fields.push(field);
  }

  return saveUserData(userData);
};

export const addFinancialRecord = (userId: string, record: FinancialRecord): boolean => {
  const userData = getUserData(userId);
  if (!userData) return false;

  userData.financialRecords.push(record);
  return saveUserData(userData);
};
