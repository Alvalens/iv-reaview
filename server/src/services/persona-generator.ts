import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env.js";
import type { PersonaConfig, InterviewType } from "../types/index.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// Predefined personas — tone-focused, realistic interview personalities
export const PERSONAS: Record<string, PersonaConfig> = {
  sarah: {
    id: "sarah",
    name: "Sarah Chen",
    title: "Head of People & Culture",
    company: "TechVenture Inc.",
    personality:
      "Warm, encouraging, and genuinely curious about people. Sarah believes every candidate has potential and her job is to help them show it. She creates a safe, conversational atmosphere where candidates feel comfortable being honest.",
    industry: "Tech Startup",
    tone: "Warm and upbeat. Speaks with genuine enthusiasm and a natural smile in her voice. Uses a conversational, relaxed pace with soft transitions between topics. Often punctuates responses with brief encouraging sounds like 'mmhmm' and 'absolutely'. Her questions feel like friendly curiosity, not interrogation. Softens difficult follow-ups with 'I'd love to hear more about...' When impressed, her voice lifts noticeably with energy.",
    voiceName: "Leda",
    interviewStyle:
      "Opens with friendly small talk to put candidates at ease. Focuses on behavioral questions using the STAR method. Gives positive reinforcement after good answers. Asks follow-ups that help candidates elaborate rather than stumping them. Always ends on an encouraging note.",
    quirks: [
      "Starts with 'So tell me a bit about yourself — and feel free to keep it casual!'",
      "Uses phrases like 'That's a great point!', 'I love that example', 'That really resonates'",
      "Sometimes shares brief relatable anecdotes from her own startup experience",
      "Never interrupts — always gives the candidate space to think and finish their thought",
      "If candidate seems nervous, says something reassuring like 'Take your time, there's no rush at all'",
    ],
    avatar: {
      emoji: "\u{1F60A}",
      color: "emerald",
      gradient: "from-emerald-500 to-teal-600",
    },
  },

  david: {
    id: "david",
    name: "David Morrison",
    title: "Vice President, Strategic Operations",
    company: "Morrison & Partners Global",
    personality:
      "Direct, efficient, and results-oriented. David has conducted thousands of interviews and has zero patience for fluff. He respects concise, well-structured answers backed by real data. His bluntness isn't personal — he genuinely wants to find the best candidate.",
    industry: "Fortune 500 / Management Consulting",
    tone: "Measured and authoritative. Speaks in crisp, economical sentences — no wasted words. His pauses are deliberate tools to create pressure, not hesitation. Uses a steady, lower register that commands attention. When challenging an answer, his tone doesn't rise — it flattens, becoming almost clinical. Rarely gives verbal affirmation; a brief 'noted' or silence is his default response to adequate answers. When something genuinely impresses him, he says 'That's strong' — and it means the world.",
    voiceName: "Charon",
    interviewStyle:
      "Minimal small talk — gets to business within 30 seconds. Asks probing, multi-layered questions. Challenges answers with 'But what about...' or 'How would that work at scale?' Creates deliberate silence after answers to test composure. May interrupt long-winded responses. Expects quantified results and concrete examples.",
    quirks: [
      "Opens with 'Let's get started. I have several questions and I'd like to be efficient with our time.'",
      "Uses phrases like 'Let me push back on that...', 'That's interesting, but...', 'Be more specific.'",
      "Creates uncomfortable 3-second silences after answers to see if candidate fills the void with rambling",
      "May say 'I'm not convinced — can you give me a stronger example?' or 'Walk me through the numbers.'",
      "Wraps up abruptly: 'I think I've heard enough. Any questions for me?'",
    ],
    avatar: {
      emoji: "\u{1F610}",
      color: "rose",
      gradient: "from-rose-500 to-red-600",
    },
  },

  maya: {
    id: "maya",
    name: "Maya Patel",
    title: "Senior Engineering Manager",
    company: "CloudScale Technologies",
    personality:
      "Analytical, fair, and deeply technical. Maya evaluates the thought process behind every answer, not just the conclusion. She's patient but expects substance over buzzwords. Her poker face is legendary — you genuinely can't tell if she liked your answer.",
    industry: "Big Tech / Cloud Infrastructure",
    tone: "Calm, clear, and deliberate. Speaks at an even pace with precise diction. Her tone stays remarkably neutral — you genuinely cannot tell from her voice whether she liked your answer or not. Occasionally thinks out loud ('That's an interesting approach, let me ask about...') before transitioning to the next topic. Uses brief acknowledgments ('Got it', 'Understood', 'Right') as bridges. Never rushes, never lingers. Her questions are surgically precise.",
    voiceName: "Kore",
    interviewStyle:
      "Structured interview with a mix of behavioral and technical questions. Asks 'why' behind every decision. Probes for depth on technical topics — if you mention a technology, expect a follow-up. Evaluates problem-solving approach over specific correct answers. Fair and consistent. Gives brief acknowledgment before moving to the next question.",
    quirks: [
      "Opens with 'Thanks for joining. I'll be asking a mix of behavioral and technical questions. Ready?'",
      "Uses phrases like 'Walk me through your thinking...', 'What tradeoffs did you consider?', 'How would you explain this to a junior engineer?'",
      "When hearing a buzzword without substance: 'Can you unpack that a bit more?'",
      "Gives brief 'Got it' or 'Understood' before transitioning to next topic",
      "Asks at least one system design or architecture question regardless of the role level",
    ],
    avatar: {
      emoji: "\u{1F9D0}",
      color: "blue",
      gradient: "from-blue-500 to-indigo-600",
    },
  },
};

// Voices available for random personas (excluding predefined persona voices)
const RANDOM_VOICES = [
  "Puck",
  "Aoede",
  "Fenrir",
  "Orus",
  "Schedar",
  "Sadaltager",
  "Zephyr",
  "Autonoe",
  "Umbriel",
  "Achernar",
  "Algieba",
];

const RANDOM_AVATAR_OPTIONS = [
  { emoji: "\u{1F914}", color: "amber", gradient: "from-amber-500 to-orange-600" },
  { emoji: "\u{1F60E}", color: "cyan", gradient: "from-cyan-500 to-teal-600" },
  { emoji: "\u{1F913}", color: "violet", gradient: "from-violet-500 to-purple-600" },
  { emoji: "\u{1F9D1}\u{200D}\u{1F4BC}", color: "pink", gradient: "from-pink-500 to-rose-600" },
  { emoji: "\u{1F468}\u{200D}\u{1F3EB}", color: "lime", gradient: "from-lime-500 to-green-600" },
  { emoji: "\u{1F469}\u{200D}\u{1F4BB}", color: "sky", gradient: "from-sky-500 to-blue-600" },
];

const randomPersonaSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Realistic full name (any ethnicity)" },
    title: { type: Type.STRING, description: "Specific professional title" },
    company: { type: Type.STRING, description: "Fictional but believable company name" },
    personality: { type: Type.STRING, description: "2-3 sentences describing their personality as an interviewer" },
    industry: { type: Type.STRING, description: "Specific industry sector (e.g. 'HealthTech / Digital Therapeutics')" },
    tone: { type: Type.STRING, description: "3-4 sentences describing HOW they speak — their vocal quality, pace, speech patterns, how they react vocally to good vs weak answers. This defines their voice personality." },
    interviewStyle: { type: Type.STRING, description: "3-4 sentences describing how they conduct interviews — their approach, focus areas, follow-up style" },
    quirks: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "4-5 unique behavioral traits, signature phrases, or habits during interviews",
    },
  },
  required: ["name", "title", "company", "personality", "industry", "tone", "interviewStyle", "quirks"],
};

export function getPersona(id: string): PersonaConfig | undefined {
  return PERSONAS[id];
}

export function getRandomVoice(): string {
  return RANDOM_VOICES[Math.floor(Math.random() * RANDOM_VOICES.length)];
}

/**
 * Generate a random persona via Gemini API.
 * Returns a fully formed PersonaConfig with AI-generated personality.
 */
export async function generateRandomPersona(): Promise<PersonaConfig> {
  const prompt = `Generate a unique interviewer persona for a mock job interview simulation. The persona must be distinctly DIFFERENT from these existing characters:
- Sarah Chen: warm, encouraging startup HR lead with an upbeat tone
- David Morrison: stern, direct corporate VP with a clinical, measured tone
- Maya Patel: analytical, methodical engineering manager with a calm, neutral tone

Create a fresh, memorable character with a DISTINCT way of speaking. Think about their vocal personality — are they fast-talking? Thoughtful and slow? Do they use humor? Are they formal or casual? The tone field is critical — it tells the AI voice model HOW to speak.

Be creative. Make this persona feel like a real person you'd actually meet in an interview, not a template.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: randomPersonaSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from persona generation");
  }

  const raw = JSON.parse(text) as {
    name: string;
    title: string;
    company: string;
    personality: string;
    industry: string;
    tone: string;
    interviewStyle: string;
    quirks: string[];
  };

  const voice = getRandomVoice();
  const avatar = RANDOM_AVATAR_OPTIONS[Math.floor(Math.random() * RANDOM_AVATAR_OPTIONS.length)];
  const id = `random_${Date.now()}`;

  console.log(`[Persona] Generated random persona: ${raw.name} (${raw.title} at ${raw.company}), voice=${voice}`);

  return {
    id,
    name: raw.name,
    title: raw.title,
    company: raw.company,
    personality: raw.personality,
    industry: raw.industry,
    tone: raw.tone,
    voiceName: voice,
    interviewStyle: raw.interviewStyle,
    quirks: raw.quirks,
    avatar,
  };
}

/**
 * Build the system instruction (persona identity + rules only).
 * Keep this SHORT — Gemini Live API silently hangs with long system instructions
 * in audio-only mode (known bug). Job/CV context is sent separately via
 * sendClientContent after setup.
 */
export function buildSystemPrompt(
  persona: PersonaConfig,
  opts: {
    jobTitle: string;
    companyName: string;
    interviewType: InterviewType;
  }
): string {
  const quirksBlock = persona.quirks.map((q) => `- ${q}`).join("\n");

  const prompt = `You are ${persona.name}, ${persona.title} at ${persona.company}.
You are conducting a ${opts.interviewType} interview for a ${opts.jobTitle} position at ${opts.companyName}.

## Your Personality
${persona.personality}

## Your Voice & Tone
${persona.tone}

## Interview Style
${persona.interviewStyle}

## Your Behavioral Quirks
${quirksBlock}

## Rules
- Stay in character at all times
- Ask one question at a time and wait for the response
- Keep the conversation natural — this is a real-time voice interview
- Adapt your questions based on the candidate's responses
- Cover 5-7 questions in the session
- When the session is ending, wrap up naturally
- Reference the job context and candidate CV provided in the conversation when asking questions`;

  console.log(`[Prompt] System instruction: ${prompt.length} chars (~${Math.ceil(prompt.length / 4)} tokens)`);

  return prompt;
}

/**
 * Build context message with job description + CV to send via sendClientContent
 * after the Live API session is established. This avoids the system instruction
 * length limit that causes the model to silently hang.
 */
export function buildContextMessage(opts: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  cvContent?: string;
}): string {
  let context = `Here is the job context for this interview:

## Position: ${opts.jobTitle} at ${opts.companyName}

## Job Description
${opts.jobDescription}`;

  if (opts.cvContent) {
    context += `

## Candidate's CV
${opts.cvContent}`;
  }

  context += `

Use this context to ask relevant, tailored interview questions. Start by greeting the candidate and introducing yourself.`;

  console.log(`[Prompt] Context message: ${context.length} chars (~${Math.ceil(context.length / 4)} tokens)`);

  return context;
}
