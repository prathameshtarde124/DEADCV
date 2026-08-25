// ═════════════════════════════════════════════════════════════
// DEADCV ROAST ENGINE — THE BRUTAL RESUME AUTOPSY BRAIN
// "recruiter.exe has entered the chat"
// ═════════════════════════════════════════════════════════════

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generate a viral resume roast. Uses Gemini AI if GEMINI_API_KEY is available,
 * otherwise runs the forensic heuristic analyzer.
 *
 * @param {string} resumeText - Full text extracted from resume
 * @param {string} targetJob - Target job title
 * @param {string} jobDescription - Optional target job description
 * @param {string} originalFilename - Original uploaded filename
 * @param {string} roastIntensity - Intensity level ('Light' | 'Brutal' | 'Unhinged')
 */
export async function generateRoastWithAI(resumeText, targetJob = 'Software Engineer', jobDescription = '', originalFilename = 'resume.pdf', roastIntensity = 'Brutal') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      return await generateGeminiRoast(resumeText, targetJob, jobDescription, originalFilename, roastIntensity, apiKey);
    } catch (err) {
      console.warn('Gemini API call failed, using Forensic Heuristic Roast Engine:', err.message);
    }
  }

  return generateForensicHeuristicRoast(resumeText, targetJob, jobDescription, originalFilename, roastIntensity);
}

// ═════════════════════════════════════════════════════════════
// GEMINI LLM ROASTER (THE WORLD'S BEST RESUME ROAST BRAIN)
// ═════════════════════════════════════════════════════════════
async function generateGeminiRoast(resumeText, targetJob, jobDescription, originalFilename, roastIntensity, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `
You are DEADCV — the funniest, most brutally observant person on the internet reviewing a user's resume.

CHARACTER & PERSONA:
- You are a brutally honest internet friend who has seen 10,000 student & developer resumes.
- You understand: LinkedIn culture, placement season panic, Indian engineering resumes, college clubs, hackathons, FAANG obsession, LeetCode, "AI-powered" tutorial projects, certificate hoarders, fake metrics, corporate buzzwords, ATS obsession.
- You do NOT sound like ChatGPT. You do NOT sound like HR or a career coach. You react like a human live-commenting on Twitch/Twitter in real-time.
- LANGUAGE STYLE: Use natural internet phrases ("bro.", "nah 😭", "be serious.", "what are we doing here", "WHO told you to write this", "respectfully, delete this", "bro discovered an API and called it a project", "you didn't build a product. you completed a tutorial.", "this isn't a skills section. this is a Pokémon inventory.").
- GOLDEN RULE: NEVER say "Your resume could be improved by...". Instead say: "bro delete this bullet" or "bro remove this line" followed by 1 short sentence real-talk explanation.

ROAST INTENSITY: ${roastIntensity.toUpperCase()}
- Light: Playful teasing, mild callouts.
- Brutal: Direct, ruthless, hilarious real talk.
- Unhinged: Full chaotic internet destruction, uninhibited roasts (keep safe from hate speech/harm).

FORENSIC INVESTIGATION:
1. Inspect the original filename: "${originalFilename}". If it contains "v2", "final", "latest", "updated", "copy", roast it!
2. Inspect the skills section count. If 15+ technologies listed, roast the technology collector ("pick a struggle").
3. Inspect projects. Check for tutorial holy trinity (Calculator, Weather, Todo, Chat app, E-commerce clone). Call out YouTube tutorial projects.
4. Check for ancient objective statements ("Seeking a challenging position...").
5. Check for "AI-powered" buzzword stacking with 0 actual results.
6. PRAISE ANYTHING GENUINELY GOOD: If there's a strong project or solid metric, call it out ("WAIT. This is actually good. Why did you bury this under 14 lines of corporate oatmeal?").

ASSIGN ONE SPECIFIC ARCHETYPE:
- LINKEDIN NPC
- TUTORIAL PROJECT WARLORD
- CERTIFICATE HOARDER
- PLACEMENT PANIC
- GITHUB GHOST
- CORPORATE FANFICTION WRITER
- TECHNOLOGY COLLECTOR
- ONE GOOD PROJECT GUY
(or invent a custom hilarious archetype matching the resume)

INPUT DATA:
- Original Filename: ${originalFilename}
- Target Job: ${targetJob}
- Job Description: ${jobDescription || 'None provided'}
- Resume Text:
"""
${resumeText.slice(0, 4000)}
"""

Return ONLY a JSON object strictly matching this schema:
{
  "deadPercentage": number (integer between 55 and 98),
  "causeOfDeath": "SHORT UPPERCASE CAUSE OF DEATH (max 8 words)",
  "stats": {
    "buzzwords": number,
    "weakBullets": number,
    "actualImpact": "percentage string e.g. 2%",
    "recruiterSurvival": "percentage string e.g. 38%",
    "personality": "Short archetype string e.g. LinkedIn corporate NPC",
    "species": "Short classification e.g. The 'I did projects' type",
    "mostDangerousWord": "Single word with count e.g. 'Developed' (7x)",
    "atsStatus": "Short status e.g. Barely breathing"
  },
  "roasts": [
    {
      "tag": "YOUR WORST BULLET / FILENAME / SKILLS OVERDOSE / TUTORIAL TRINITY",
      "target": "Exact quote or line from resume",
      "comment": "Brutal 1-2 sentence real-time reaction in persona"
    }
  ],
  "recruiterReaction": "Short 1-line quote of a recruiter closing the tab at 5 PM",
  "strongestPart": "1 sentence calling out the one genuinely good element or funny compliment",
  "biggestWeakness": "1 sentence describing the core fatal flaw",
  "shareText": "Ready to post viral caption with dead % and cause of death",
  "improvedRewrite": {
    "originalBullet": "The weakest bullet from resume",
    "critique": "Short 1-line teardown of why it's weak",
    "fixedBullet": "Quantifiable, high-impact bullet rewrite",
    "actionPlan": [
      "Action step 1",
      "Action step 2",
      "Action step 3"
    ]
  }
}
`;

  const result = await model.generateContent(prompt);
  const textResponse = result.response.text();
  return JSON.parse(textResponse);
}

// ═════════════════════════════════════════════════════════════
// FORENSIC HEURISTIC ROAST ENGINE (OFFLINE FALLBACK)
// ═════════════════════════════════════════════════════════════
function generateForensicHeuristicRoast(resumeText, targetJob, jobDescription, originalFilename, roastIntensity = 'Brutal') {
  const lowerText = resumeText.toLowerCase();
  const lowerFile = (originalFilename || '').toLowerCase();

  // 1. Forensic Inspection of Filename
  let filenameRoast = null;
  if (lowerFile.includes('final') || lowerFile.includes('updated') || lowerFile.includes('v2') || lowerFile.includes('copy') || lowerFile.includes('draft')) {
    filenameRoast = {
      tag: 'FILENAME FORENSICS',
      target: originalFilename,
      comment: `bro the resume filename has been through more versions than your career 💀 ("${originalFilename}")`
    };
  }

  // 2. Scan Technologies & Skills
  const knownTech = [
    'python', 'javascript', 'typescript', 'react', 'node', 'java', 'c++', 'c#', 'express',
    'mongodb', 'sql', 'postgresql', 'docker', 'kubernetes', 'aws', 'html', 'css', 'git',
    'tensorflow', 'pytorch', 'flutter', 'tailwind', 'redux', 'next.js', 'vue', 'angular'
  ];
  const foundTech = knownTech.filter(tech => lowerText.includes(tech));

  // 3. Scan Tutorial Projects
  const tutorialKeywords = ['calculator', 'todo', 'to-do', 'weather', 'chat app', 'portfolio', 'clone', 'tic tac toe'];
  const foundTutorials = tutorialKeywords.filter(t => lowerText.includes(t));

  // 4. Scan Certificates & Buzzwords
  const buzzwordMatches = lowerText.match(/\b(passionate|synergy|hardworking|team player|dynamic|results-driven|spearheaded|leverage|utilize|innovative|self-starter|detail-oriented)\b/gi) || [];
  const buzzwordCount = Math.max(buzzwordMatches.length, Math.floor(resumeText.length / 350));

  const certMatches = lowerText.match(/\b(certified|certificate|certification|coursera|udemy|nptel|udacity|linkedin learning)\b/gi) || [];
  const certCount = certMatches.length;

  const hasObjective = lowerText.includes('objective') || lowerText.includes('seeking a challenging') || lowerText.includes('looking for an opportunity');
  const actionVerbs = lowerText.match(/\b(developed|created|worked|built|assisted|helped|managed|handled)\b/gi) || [];

  // Count verb frequency
  const verbFreq = {};
  actionVerbs.forEach(v => {
    const key = v.toLowerCase();
    verbFreq[key] = (verbFreq[key] || 0) + 1;
  });
  let mostUsedVerb = 'developed';
  let maxVerbCount = 0;
  Object.entries(verbFreq).forEach(([v, c]) => {
    if (c > maxVerbCount) {
      maxVerbCount = c;
      mostUsedVerb = v;
    }
  });

  // 5. Check for Metrics / Numbers
  const metricMatches = resumeText.match(/\b(\d+%\b|\$\d+|\d+\+|\d+x\b|\d+\s*users|\d+\s*ms|\d+\s*k)/gi) || [];
  const metricCount = metricMatches.length;

  // Calculate Dead Score
  let score = 62;
  if (foundTech.length > 12) score += 10;
  if (foundTutorials.length > 0) score += 12;
  if (metricCount === 0) score += 14;
  if (hasObjective) score += 8;
  if (buzzwordCount > 8) score += 6;
  score = Math.min(96, Math.max(58, score));

  // Determine Cause of Death
  let causeOfDeath = 'ZERO MEASURABLE IMPACT';
  if (foundTutorials.length >= 2) causeOfDeath = 'TUTORIAL PROJECT OVERDOSE';
  else if (foundTech.length >= 14) causeOfDeath = 'LISTED THE ENTIRE IT INDUSTRY';
  else if (buzzwordCount >= 10) causeOfDeath = 'DECEASED FROM BUZZWORD OVERDOSE';
  else if (hasObjective) causeOfDeath = 'OBJECTIVE STATEMENT FROM 2012';

  // Determine Archetype
  let personality = 'LINKEDIN CORPORATE NPC';
  if (foundTutorials.length >= 2) personality = 'TUTORIAL PROJECT WARLORD';
  else if (certCount >= 4) personality = 'CERTIFICATE HOARDER';
  else if (foundTech.length >= 14) personality = 'TECHNOLOGY COLLECTOR';
  else if (buzzwordCount >= 10) personality = 'CORPORATE FANFICTION WRITER';
  else if (metricCount === 0) personality = 'PLACEMENT PANIC';

  // Generate Observations
  const roasts = [];

  if (filenameRoast) {
    roasts.push(filenameRoast);
  }

  if (foundTutorials.length > 0) {
    roasts.push({
      tag: 'TUTORIAL STARTER PACK',
      target: `Projects found: ${foundTutorials.join(', ')}`,
      comment: `THE HOLY TRINITY OF TUTORIAL PROJECTS 💀 bro completed the YouTube starter pack. you didn't build a product, you completed a tutorial.`
    });
  }

  if (foundTech.length >= 12) {
    roasts.push({
      tag: 'POKÉMON INVENTORY SKILLS',
      target: `${foundTech.length} technologies listed (${foundTech.slice(0, 6).join(', ')}...)`,
      comment: `BRO LISTED THE ENTIRE TECHNOLOGY INDUSTRY. this isn't a skills section, this is a Pokémon inventory. pick a struggle.`
    });
  }

  if (hasObjective) {
    roasts.push({
      tag: 'ANCIENT OBJECTIVE STATEMENT',
      target: '"Seeking a challenging position where I can utilize my skills..."',
      comment: `this sentence has been on the internet since dinosaurs had internships. respectfully, delete this immediately.`
    });
  }

  if (metricCount === 0) {
    roasts.push({
      tag: 'NO MEASURABLE IMPACT',
      target: 'Entire Experience & Projects Section',
      comment: `0 metrics found. no percentages, no user counts, no speed improvements. you wrote a memoir, not an achievement list.`
    });
  } else {
    roasts.push({
      tag: 'MOST ABUSED WORD',
      target: `"${mostUsedVerb.toUpperCase()}" used ${maxVerbCount || 5} times`,
      comment: `you ${mostUsedVerb} so much you forgot to achieve anything. mix in some actual results.`
    });
  }

  // Ensure at least 3 roasts
  if (roasts.length < 3) {
    roasts.push({
      tag: 'BUZZWORD OVERLOAD',
      target: `"Passionate & hard-working team player"`,
      comment: `said everyone, ever, always. remove every adjective and tell me what the thing actually does.`
    });
  }

  // Find worst bullet
  const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 20);
  const worstLine = lines.find(l => l.toLowerCase().includes('responsible') || l.toLowerCase().includes('worked') || l.toLowerCase().includes('assisted')) || lines[0] || 'Worked on various projects.';

  // Praise if something good exists
  let strongestPart = 'Your name is spelled correctly.';
  if (metricCount > 0) {
    strongestPart = `WAIT. You actually included real numbers (${metricMatches.slice(0, 2).join(', ')}). Why did you bury this under corporate oatmeal?`;
  } else if (foundTech.length > 0) {
    strongestPart = `You actually know modern tools like ${foundTech[0]}. Now prove you used them for real results.`;
  }

  return {
    deadPercentage: score,
    causeOfDeath,
    stats: {
      buzzwords: buzzwordCount,
      weakBullets: Math.max(3, Math.floor(lines.length * 0.6)),
      actualImpact: metricCount > 0 ? `${Math.min(45, metricCount * 12)}%` : '2%',
      recruiterSurvival: `${Math.max(12, 100 - score)}%`,
      personality,
      species: foundTech.length > 10 ? 'The Technology Collector' : 'The "I did projects" type',
      mostDangerousWord: `"${mostUsedVerb}" (${maxVerbCount || 5}x)`,
      atsStatus: score > 80 ? 'Flatlining in ATS Spam Filter' : 'Barely breathing'
    },
    roasts: roasts.slice(0, 4),
    recruiterReaction: `“Okay... but what did this person actually accomplish?” *closes tab at 5:01 PM*`,
    strongestPart,
    biggestWeakness: metricCount === 0 ? 'Zero measurable business impact or percentage gains.' : 'Drowning key achievements under vague corporate filler.',
    shareText: `DEADCV just told me my resume is ${score}% dead 💀\nCause of death: ${causeOfDeath}\nCheck yours before a recruiter does: https://deadcv.com`,
    improvedRewrite: {
      originalBullet: worstLine,
      critique: 'Passive voice, generic duties, zero measurable metric ownership.',
      fixedBullet: `Engineered core module reducing service query latency by 32% for 10K+ active users.`,
      actionPlan: [
        'Replace all "responsible for" with concrete percentage gains.',
        'Remove skill bar meters and tutorial starter-pack projects.',
        'Condense bullet points to max 2 lines with action verb + metric.'
      ]
    }
  };
}
