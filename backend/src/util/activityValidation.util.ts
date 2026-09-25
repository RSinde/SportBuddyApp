import {
  CreateActivityDto,
  SkillLevel,
} from "../models/activity.model";
import { isValidCoordinates } from "./geo.util";

const VALID_SKILL_LEVELS: SkillLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "competitive",
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidSkillLevel(value: unknown): value is SkillLevel {
  return (
    typeof value === "string" &&
    VALID_SKILL_LEVELS.includes(value as SkillLevel)
  );
}

export function parseCreateActivityDto(body: any): CreateActivityDto {
  if (!isNonEmptyString(body.title)) {
    throw new Error("title is required");
  }

  if (body.title.trim().length > 100) {
    throw new Error("title is too long");
  }

  if (!isNonEmptyString(body.description)) {
    throw new Error("description is required");
  }

  if (body.description.trim().length > 1000) {
    throw new Error("description is too long");
  }

  if (!isNonEmptyString(body.sportId)) {
    throw new Error("sportId is required");
  }

  if (
    typeof body.maxParticipants !== "number" ||
    !Number.isInteger(body.maxParticipants) ||
    body.maxParticipants < 2
  ) {
    throw new Error("maxParticipants must be an integer greater than or equal to 2");
  }

  if (!body.location) {
    throw new Error("location is required");
  }

  if (!isNonEmptyString(body.location.name)) {
    throw new Error("location.name is required");
  }

  if (!isNonEmptyString(body.location.address)) {
    throw new Error("location.address is required");
  }

  const location = {
    name: body.location.name.trim(),
    address: body.location.address.trim(),
    lat: Number(body.location.lat),
    lng: Number(body.location.lng),
  };

  if (!isValidCoordinates({ lat: location.lat, lng: location.lng })) {
    throw new Error("location coordinates are invalid");
  }

  const date = new Date(body.date);

  if (Number.isNaN(date.getTime())) {
    throw new Error("date must be a valid date");
  }

  if (date <= new Date()) {
    throw new Error("date must be in the future");
  }

  if (!isValidSkillLevel(body.difficultyLevel)) {
    throw new Error("difficultyLevel is invalid");
  }

  if (
    body.requiresApproval !== undefined &&
    typeof body.requiresApproval !== "boolean"
  ) {
    throw new Error("requiresApproval must be a boolean");
  }

  return {
    title: body.title.trim(),
    description: body.description.trim(),
    sportId: body.sportId.trim(),
    maxParticipants: body.maxParticipants,
    location,
    date,
    difficultyLevel: body.difficultyLevel,
    requiresApproval: body.requiresApproval ?? false,
  };
}