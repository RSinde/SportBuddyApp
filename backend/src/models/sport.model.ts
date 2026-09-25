export type SportCategory = "team" | "individual";

export type Sport = {
  id: string;
  name: string;
  description: string;
  category: SportCategory;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSportDto = {
  name: string;
  description: string;
  category: SportCategory;
};

export type UpdateSportDto = {
  name?: string;
  description?: string;
  category?: SportCategory;
};

export function createSportObject(id: string, data: CreateSportDto): Sport {
  const now = new Date();
  return {
    id,
    name: data.name,
    description: data.description,
    category: data.category,
    createdAt: now,
    updatedAt: now,
  };
}