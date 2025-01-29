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
	RP_ID: z.array(z.string()).default(["localhost"]),
	RP_NAME: z.array(z.string()).default(["App"]),
	EXPECTED_ORIGIN: z.array(z.string()).default(["http://localhost:3000"]),
	CHALLENGE_TTL_SECONDS: z.coerce.number().default(60),
});

type Env = z.infer<typeof envSchema>;

let ENV: Env & { CHALLENGE_TTL_MS: number };

try {
	const parsed = envSchema.parse(process.env);
	ENV = {
		...parsed,
		CHALLENGE_TTL_MS: parsed.CHALLENGE_TTL_SECONDS * 1000,
	};
	console.log(ENV);
} catch (err) {
	if (err instanceof z.ZodError) {
		console.error(err.issues);
	}
	process.exit(1);
}

export { ENV };
