/* Writes the two files behind the resume page's download buttons, from
   RESUME in lib/content.ts. Rerun it whenever the resume content changes.

     public/resume.tex  Jake Gutierrez's resume template (MIT), filled in
     public/resume.pdf  the /resume/ sheet printed to A4

   The PDF is printed from a running site, so start one first (the dev
   server, or the static export on :4311) and point BASE at it.

     BASE=http://localhost:3000 node tools/resume-export.mjs */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { PERSON, RESUME } from "../lib/content.ts";

const BASE = process.env.BASE ?? "http://localhost:3000";
const out = (name) => new URL(`../public/${name}`, import.meta.url);

/* Text from the content file into LaTeX: escape the specials, then turn
   **bold** into \textbf and typographic dashes and quotes into TeX's. */
const esc = (s) =>
  s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}")
    .replace(/—/g, "---")
    .replace(/–/g, "--")
    .replace(/[‘’]/g, "'");

const items = (bullets, pad) =>
  bullets.map((b) => `${pad}\\resumeItem{${esc(b)}}`).join("\n");

const { education: edu, experience: exp, projects, skills } = RESUME;

const tex = String.raw`%-------------------------
% Resume in Latex
% Author : Jake Gutierrez
% Based off of: https://github.com/sb2nov/resume
% License : MIT
%------------------------

\documentclass[a4paper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}

\pagestyle{fancy}
\fancyhf{} % clear all header and footer fields
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

%-------------------------------------------
%%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%


\begin{document}

%----------HEADING----------
\begin{center}
    \textbf{\Huge \scshape ${esc(PERSON.name)}} \\ \vspace{1pt}
    \small \href{mailto:${PERSON.email}}{\underline{${esc(PERSON.email)}}} $|$
    \href{${PERSON.linkedin}}{\underline{${esc(PERSON.linkedinLabel)}}} $|$
    \href{${PERSON.github}}{\underline{${esc(PERSON.githubLabel)}}}
\end{center}


%-----------EDUCATION-----------
\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {${esc(edu.school)}}{${esc(edu.where)}}
      {${esc(edu.degree)}}{${esc(edu.period)}}
  \resumeSubHeadingListEnd


%-----------EXPERIENCE-----------
\section{Experience}
  \resumeSubHeadingListStart

    \resumeSubheading
      {${esc(exp.title)}}{${esc(exp.period)}}
      {${esc(exp.org)}}{${esc(exp.where)}}
      \resumeItemListStart
${items(exp.bullets, "        ")}
      \resumeItemListEnd

  \resumeSubHeadingListEnd


%-----------PROJECTS-----------
\section{Projects}
    \resumeSubHeadingListStart
${projects.map((p) => String.raw`      \resumeProjectHeading
          {\textbf{${esc(p.name)}} $|$ \emph{${esc(p.stack)}}}{${esc(p.period)}}
          \resumeItemListStart
${items(p.bullets, "            ")}
          \resumeItemListEnd`).join("\n")}
    \resumeSubHeadingListEnd


%-----------TECHNICAL SKILLS-----------
\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
${skills.map((s) => `     \\textbf{${esc(s.label)}}{: ${esc(s.items)}}`).join(" \\\\\n")}
    }}
 \end{itemize}


%-------------------------------------------
\end{document}
`;

writeFileSync(out("resume.tex"), tex);
console.log("wrote public/resume.tex");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  /* Not networkidle: the dev server's live reload and the ticking
     clocks keep the network busy forever. The sheet and its fonts are
     all the print needs. */
  await page.goto(`${BASE}/resume/`, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.load('400 11pt "CMU Serif"');
    await document.fonts.load('700 11pt "CMU Serif"');
    await document.fonts.load('italic 400 11pt "CMU Serif"');
    await document.fonts.ready;
  });
  await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  writeFileSync(out("resume.pdf"), pdf);
  console.log(`wrote public/resume.pdf (${pdf.length} bytes) from ${BASE}/resume/`);
} finally {
  await browser.close();
}
