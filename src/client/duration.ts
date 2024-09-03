type Unit = "ms" | "s" | "m" | "h" | "d";

export type Duration = `${bigint}${Unit}`;
