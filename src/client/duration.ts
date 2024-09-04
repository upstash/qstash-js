type Unit = "s" | "m" | "h" | "d";

// Using "bigint" instead of "number" as number allows "20 s" while bigint does not.
export type Duration = `${bigint}${Unit}`;
