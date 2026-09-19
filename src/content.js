/**
 * Site content - everything a visitor reads.
 *
 * This is the single source of truth for the portfolio's text. Edit here to update
 * the site; no other file needs to change.
 *
 * Island geometry:
 *   pos   [x, z] in world units (the sailable world is ~470 across)
 *   r     island radius
 *   pier  pier direction in radians (defaults to pointing at Home Harbor)
 */
export const CONTENT = {
  name: 'Muhammad Memon',
  role: 'Statistics & machine learning',
  tagline: 'I study statistics at the University of Toronto and build machine-learning tools. Sail between the islands to see what I’ve been working on.',
  islands: [
    {
      id: 'home', kind: 'lighthouse', section: 'home',
      title: 'Home Harbor', sub: 'Start here', color: '#d7263d',
      pos: [0, 0], r: 13, pier: Math.PI / 2, labelY: 23,
      summary: 'Hi, I’m Muhammad. I study Statistical Science at the University of Toronto and build ML tools, from hackathon prototypes to research on making models cheaper to run.',
      body: `<p>Every island holds one chapter: my resume, a bit about me, three things I’ve built, the teams I help run, and a signal tower for getting in touch.</p>
             <p>Sail close to an island and go ashore to read it, or click an island’s name and the boat will take you there. Four bottles are drifting somewhere out at sea, each with a note inside.</p>`,
      actions: ['resume']
    },
    {
      id: 'resume', kind: 'logbook', section: 'resume',
      title: 'The Logbook', sub: 'My resume', color: '#3d9b4f', action: 'Open resume',
      pos: [30, 95], r: 10, labelY: 16,
      summary: 'My full resume on one page: education, experience, projects and skills.',
      actions: ['resume']
    },
    {
      id: 'about', kind: 'cabin', section: 'about',
      title: 'The Cabin', sub: 'About me', color: '#b07a4f',
      pos: [-78, 52], r: 12, labelY: 14,
      summary: 'Specialist in Statistical Science: Theory and Methods at the University of Toronto, St. George.',
      meta: [['Studying', 'Statistical Science, Specialist'], ['School', 'University of Toronto'], ['Graduating', 'May 2028 (expected)'], ['Based in', 'Toronto']],
      body: `<p>My coursework covers probability, mathematical statistics, linear algebra, multivariable calculus and computer science. Outside class I work on the applied side: research on energy-efficient model training, AI tools built at hackathons, and a summer with an asset-management team.</p>
             <p>Away from the keyboard you’ll find me playing chess or badminton, lifting, or gaming.</p>`,
      tags: ['Python', 'R', 'SQL', 'C++', 'Java', 'JavaScript', 'PyTorch', 'Transformers & LLMs', 'RAG', 'OCR pipelines', 'Docker', 'AWS', 'Google Cloud', 'Git', 'Bloomberg Terminal']
    },
    {
      id: 'lectra', kind: 'knot', section: 'work',
      title: 'Lectra', sub: '2nd place, EmberHacks 2025', color: '#6f5ce6',
      pos: [88, 64], r: 11, labelY: 17,
      cover: '<rect x="30" y="18" width="92" height="62" rx="8" fill="currentColor"/><g fill="rgba(0,0,0,.18)"><rect x="42" y="32" width="54" height="7" rx="3.5"/><rect x="42" y="46" width="68" height="7" rx="3.5"/><rect x="42" y="60" width="40" height="7" rx="3.5"/></g><g fill="currentColor"><rect x="132" y="52" width="8" height="30" rx="4"/><rect x="146" y="38" width="8" height="58" rx="4"/><rect x="160" y="58" width="8" height="18" rx="4"/><rect x="174" y="46" width="8" height="42" rx="4"/></g>',
      summary: 'An AI lecture companion that turns lecture audio and whiteboard photos into accessible notes.',
      meta: [['Result', '2nd of 30+ teams'], ['Built in', '24 hours'], ['Built with', 'Python, Gemini API, OCR']],
      body: `<p>Lectra runs a multimodal pipeline: it transcribes the lecture audio, reads the board with OCR, and uses Gemini to combine both into notes formatted for accessibility. Transcription accuracy came in at around 92%.</p>
             <p>We shipped the whole prototype end to end during the 24-hour hackathon and placed second out of more than 30 teams for tackling a real accessibility gap.</p>`,
      tags: ['Multimodal AI', 'Accessibility', 'Hackathon'],
      /*
       * Hiring managers look for a live demo or source on every project, so add links
       * here once each one has somewhere public to point at. The first link renders as
       * the primary button and the rest as outlines; external links open in a new tab.
       * The same `links` array works on any island.
       *
       * links: [
       *   { label: 'Live demo', href: 'https://lectra.your-domain.com' },
       *   { label: 'Source', href: 'https://github.com/Muhammad-Memon542/lectra' }
       * ]
       */
    },
    {
      id: 'efficient-ml', kind: 'crystal', section: 'work',
      title: 'Leaner Models', sub: 'Energy-efficient ML research', color: '#e8962e',
      pos: [124, -46], r: 12, labelY: 17,
      cover: '<polygon points="112,8 60,68 94,68 84,112 140,48 104,48" fill="currentColor"/><polygon points="94,68 84,112 140,48 118,48" fill="rgba(0,0,0,.14)"/>',
      summary: 'Research on how much energy it takes to train and run models, and how to cut it without losing accuracy.',
      meta: [['Role', 'Research contributor'], ['Since', '2025'], ['Built with', 'PyTorch, quantization, pruning']],
      body: `<p>I benchmarked compute and energy trade-offs across six model architectures and found configurations that cut training energy by about 30%.</p>
             <p>I also profiled PyTorch training runs and applied quantization and pruning, which brought inference cost down by about 40% with less than 2% accuracy loss.</p>`,
      tags: ['Model compression', 'Benchmarking', 'Profiling']
    },
    {
      id: 'fund-reporting', kind: 'stack', section: 'work',
      title: 'Fund Reporting', sub: 'NBP Funds internship, 2026', color: '#1fa596',
      pos: [28, -112], r: 11, labelY: 18,
      cover: '<g fill="currentColor"><rect x="48" y="70" width="18" height="36" rx="2"/><rect x="74" y="54" width="18" height="52" rx="2"/><rect x="100" y="62" width="18" height="44" rx="2"/><rect x="126" y="34" width="18" height="72" rx="2"/></g><polyline points="50,52 82,34 108,44 150,14" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
      summary: 'Python automation for an asset-management team’s weekly fund-performance reports.',
      meta: [['Role', 'Asset Management Intern'], ['Company', 'NBP Fund Management Limited'], ['When', 'June to August 2026'], ['Built with', 'Python, Excel, Bloomberg Terminal']],
      body: `<p>Over the summer I supported the investments team with equity research and portfolio analytics across eight mutual-fund products managing $120M in assets.</p>
             <p>I also wrote Python scripts that automated five weekly fund-performance reports, cutting the manual time spent on them by about 70%.</p>`,
      tags: ['Finance', 'Automation', 'Portfolio analytics']
    },
    {
      id: 'leadership', kind: 'observatory', section: 'lab', heading: 'Leadership',
      title: 'The Observatory', sub: 'Leadership and teams', color: '#5d82b0',
      pos: [-98, -72], r: 10, labelY: 14,
      summary: 'The student teams and communities I help run outside class.',
      body: `<ul>
               <li><strong>UTMIST, Finance &amp; Internal Operations Director</strong> (Sep 2026 to now). I manage the budget, financial records and University funding applications for one of U of T’s largest AI/ML student organizations, with 8 departments and 150+ volunteers, and oversee procurement, reimbursements and task tracking so the AI conference, hackathons and 10+ ML project teams stay on schedule.</li>
               <li><strong>DeerHacks, Associate</strong> (Sep 2026 to now). I help organize UTM’s largest annual hackathon, 36 hours with 300+ hackers selected from 600+ applicants, supporting logistics, workshops and sponsor coordination.</li>
               <li><strong>U of T Computer Science Student Council, Logistics Coordinator</strong> (Sep 2025 to Apr 2026). I coordinated 12+ workshops and events reaching 400+ students and aligned timelines, approvals and purchasing across three teams, keeping 95% of events on schedule.</li>
               <li><strong>CodeCipher, Founder</strong> (2024). I started a non-profit teaching coding to 100+ high-school students across 4 schools, with a three-tier curriculum from beginner to advanced. 90% of 80+ participants reported better coding skills and confidence.</li>
             </ul>`
    },
    {
      id: 'contact', kind: 'tower', section: 'contact',
      title: 'Signal Tower', sub: 'Get in touch', color: '#e0b400',
      pos: [-24, 150], r: 10, labelY: 22,
      summary: 'Internships, research, or a hackathon team that needs one more? My inbox is open.',
      body: `<p>Email is the quickest way to reach me, and I’m also on LinkedIn and GitHub. My resume is in the Logbook if you’d like the full picture.</p>`,
      actions: ['resume'],
      links: [
        { label: 'muhammadmemon542@gmail.com', href: 'mailto:muhammadmemon542@gmail.com' },
        { label: 'LinkedIn', href: 'https://www.linkedin.com/in/muhammad-memon22' },
        { label: 'GitHub', href: 'https://github.com/Muhammad-Memon542' }
      ]
    }
  ],
  bottles: [
    { pos: [46, 34], note: 'Chess, badminton, weightlifting and video games. That’s where the rest of my week goes.' },
    { pos: [-136, -8], note: 'Lectra went from nothing to a working, prize-winning prototype inside a single 24-hour hackathon.' },
    { pos: [166, 22], note: 'This whole archipelago is built in code — no image files, no textures. Every shape you see is generated at runtime.' },
    { pos: [-52, -152], note: 'DeerHacks picks 300+ hackers from over 600 applicants. If you’re one of them, come say hi.' }
  ],
  /* The resume shown in the Logbook. The downloadable PDF lives in /assets (filename below). */
  resume: {
    filename: 'Muhammad_Memon_Resume.pdf',
    contact: [
      { label: 'muhammadmemon542@gmail.com', href: 'mailto:muhammadmemon542@gmail.com' },
      { label: 'linkedin.com/in/muhammad-memon22', href: 'https://www.linkedin.com/in/muhammad-memon22' },
      { label: 'github.com/Muhammad-Memon542', href: 'https://github.com/Muhammad-Memon542' }
    ],
    sections: [
      { title: 'Education', entries: [
        { title: 'University of Toronto, St. George', right: 'Toronto, ON',
          sub: 'Bachelor of Science, Specialist in Statistical Science: Theory and Methods', subRight: 'Expected May 2028',
          bullets: ['Relevant Coursework: Probability, Mathematical Statistics, Linear Algebra, Multivariable Calculus, Computer Science'] }
      ] },
      { title: 'Experience & Leadership', entries: [
        { title: 'Finance & Internal Operations Director', right: 'Sep 2026 – Present',
          sub: 'University of Toronto Machine Intelligence Student Team (UTMIST)', subRight: 'Toronto, ON',
          bullets: ['Manage the operating budget, financial records, and University funding applications for one of U of T’s largest AI/ML student organizations (8 departments, 150+ volunteers).',
                    'Oversee internal operations, including procurement, reimbursements, and cross-department task tracking, to keep flagship initiatives such as an AI conference, hackathons, and 10+ ML project teams on schedule.'] },
        { title: 'Associate', right: 'Sep 2026 – Present',
          sub: 'DeerHacks Hackathon, UTM Mathematics & Computational Sciences Society (MCSS)', subRight: 'Mississauga, ON',
          bullets: ['Support the organizing team for DeerHacks, UTM’s largest annual hackathon (300+ hackers selected from 600+ applicants over 36 hours), assisting with event logistics, workshops, and sponsor coordination.'] },
        { title: 'Asset Management Intern', right: 'Jun 2026 – Aug 2026',
          sub: 'NBP Funds (NBP Fund Management Limited)',
          bullets: ['Supported the investments team with equity research and portfolio analytics across 8 mutual-fund products managing $120M in AUM using Bloomberg Terminal and Excel.',
                    'Built Python scripts that automated fund-performance reporting, cutting manual reporting time by ~70% across 5 weekly reports.'] },
        { title: 'Logistics Coordinator', right: 'Sep 2025 – Apr 2026',
          sub: 'Computer Science Student Council, University of Toronto', subRight: 'Toronto, ON',
          bullets: ['Coordinated end-to-end logistics for 12+ technical workshops and community events reaching 400+ students across two terms, delivering event plans and staffing schedules for each.',
                    'Aligned timelines, approvals, and purchasing across 3 teams (Programming, Finance, Marketing), keeping 95% of events on schedule.'] },
        { title: 'Founder', right: 'Jun 2024 – Jul 2024',
          sub: 'CodeCipher (Coding Education Non-Profit)', subRight: 'Toronto, ON',
          bullets: ['Founded a non-profit teaching coding to 100+ high-school students across 4 schools in its first year.',
                    'Designed a 3-tier curriculum spanning beginner to advanced; 90% of 80+ participants reported improved coding skills and confidence.'] }
      ] },
      { title: 'Projects', entries: [
        { title: 'Lectra — AI-Powered Lecture Companion', tech: 'Python, Gemini API, OCR', right: '2nd Place, EmberHacks 2025',
          bullets: ['Engineered a multimodal AI pipeline (transcription, OCR, Gemini) converting lecture audio and board images into accessibility-formatted notes with ~92% transcription accuracy.',
                    'Shipped an end-to-end prototype in 24 hours; placed 2nd of 30+ teams for solving a real accessibility gap.'] },
        { title: 'Energy Efficiency in Machine Learning', tech: 'PyTorch, Quantization, Pruning', right: '2025 – Present',
          bullets: ['Benchmarked compute and energy trade-offs across 6 model architectures as a research contributor, identifying configurations that cut training energy by ~30%.',
                    'Profiled PyTorch training runs and applied quantization and pruning, reducing inference cost by ~40% with under 2% accuracy loss.'] }
      ] },
      { title: 'Technical Skills', rows: [
        ['Languages', 'Python, R, C++, Java, JavaScript, SQL, HTML/CSS'],
        ['Machine Learning & AI', 'PyTorch, Transformers & LLMs, Retrieval-Augmented Generation (RAG), OCR pipelines'],
        ['Tools & Cloud', 'Docker, AWS, Google Cloud, Git, Bloomberg Terminal'],
        ['Interests', 'Chess, Badminton, Weightlifting, Video Games']
      ] }
    ]
  },
  allBottles: 'That’s all four. Thorough people make the best collaborators, so come say hi at the Signal Tower.',
  allIslands: 'You’ve visited every island. Thanks for sailing all the way through.'
};
