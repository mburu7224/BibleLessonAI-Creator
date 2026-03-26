import { ZodError } from "zod";
import { HttpError } from "./http-error.js";

export function parseWithSchema(schema, input) {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, "Invalid request payload.", error.issues);
    }

    throw error;
  }
}
