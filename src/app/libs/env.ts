import { z } from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().min(1000).default(3000),
	ENV: z
		.union([
			z.literal("development"),
			z.literal("testing"),
			z.literal("production"),
		])
		.default("development"),
	REDIS_URL: z.string().default(""),
	RP_ID: z
		.string()
		.transform((val) => {
			try {
				return JSON.parse(val) as string[];
			} catch {
				throw new Error("Invalid RP_ID format. Expected a JSON array string.");
			}
		})
		.default('["localhost"]'),
	RP_NAME: z
		.string()
		.transform((val) => {
			try {
				return JSON.parse(val) as string[];
			} catch {
				throw new Error(
					"Invalid RP_NAME format. Expected a JSON array string.",
				);
			}
		})
		.default('["App"]'),
	EXPECTED_ORIGIN: z
		.string()
		.transform((val) => {
			try {
				return JSON.parse(val) as string[];
			} catch {
				throw new Error(
					"Invalid EXPECTED_ORIGIN format. Expected a JSON array string.",
				);
			}
		})
		.default('["http://localhost:3000"]'),
	CHALLENGE_TTL_SECONDS: z.coerce.number().default(60),
});

type Env = z.infer<typeof envSchema>;

let ENV: Env & { CHALLENGE_TTL_MS: number };

try {
	const parsed = envSchema.parse({
		...process.env,
	});
	ENV = {
		...parsed,
		CHALLENGE_TTL_MS: parsed.CHALLENGE_TTL_SECONDS * 1000,
	};
	console.log("ENV", ENV);
} catch (err) {
	if (err instanceof z.ZodError) {
		console.error(err.issues);
	}
	process.exit(1);
}

export { ENV };
