export type SportCategory = 'team' | 'individual';

export type Sport = {
  id: string;
  name: string;
  description: string;
  category: SportCategory;
};
