import { createContext, useContext, useState, useCallback } from 'react';

export interface ExtractionJob {
  id: string;
  banco: string;
  bancoName: string;
  filename: string;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  message?: string;
  downloadUrl?: string;
  rows?: number;
  timestamp: number;
}

interface ExtractionContextType {
  jobs: ExtractionJob[];
  activeJobsCount: number;
  addJob: (job: Omit<ExtractionJob, 'id' | 'timestamp'>) => string;
  updateJob: (id: string, updates: Partial<ExtractionJob>) => void;
  removeJob: (id: string) => void;
  clearCompletedJobs: () => void;
  getJob: (id: string) => ExtractionJob | undefined;
}

const ExtractionContext = createContext<ExtractionContextType | undefined>(undefined);

export function ExtractionProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);

  const addJob = useCallback((job: Omit<ExtractionJob, 'id' | 'timestamp'>) => {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newJob: ExtractionJob = {
      ...job,
      id,
      timestamp: Date.now(),
    };
    setJobs((prev) => [...prev, newJob]);
    return id;
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<ExtractionJob>) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === id ? { ...job, ...updates } : job
      )
    );
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  const clearCompletedJobs = useCallback(() => {
    setJobs((prev) => prev.filter((job) => job.status === 'processing'));
  }, []);

  const getJob = useCallback((id: string) => {
    return jobs.find((job) => job.id === id);
  }, [jobs]);

  const activeJobsCount = jobs.filter((job) => job.status === 'processing').length;

  const value = {
    jobs,
    activeJobsCount,
    addJob,
    updateJob,
    removeJob,
    clearCompletedJobs,
    getJob,
  };

  return (
    <ExtractionContext.Provider value={value}>
      {children}
    </ExtractionContext.Provider>
  );
}

export function useExtraction() {
  const context = useContext(ExtractionContext);
  if (context === undefined) {
    throw new Error('useExtraction must be used within an ExtractionProvider');
  }
  return context;
}




















