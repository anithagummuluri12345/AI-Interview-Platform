import { InterviewCompany } from '@repo/db';

export interface CompanyProfile {
  company: InterviewCompany;
  displayName: string;
  focusInstructions: string;
  codingFocusSkills: string[];
  codingDifficultyProgression: string;
  roundStructure: string[];
  behavioralEvaluationCriteria: string[];
  technicalEvaluationCriteria: string[];
  hiringLevels: string[];
}

export const COMPANY_PROFILES: Record<InterviewCompany, CompanyProfile> = {
  [InterviewCompany.GENERIC]: {
    company: InterviewCompany.GENERIC,
    displayName: 'Generic Company',
    focusInstructions: 'Follow the standard general software engineering interview guidelines, covering generic coding, technical, and behavioral standards.',
    codingFocusSkills: ['Arrays', 'Strings', 'HashMaps', 'Stacks', 'Queues', 'LinkedLists'],
    codingDifficultyProgression: 'Easy to Medium',
    roundStructure: ['TECHNICAL', 'BEHAVIORAL'],
    behavioralEvaluationCriteria: ['Communication', 'Collaboration', 'Problem Solving'],
    technicalEvaluationCriteria: ['Problem Solving', 'Technical Accuracy', 'Code Elegance'],
    hiringLevels: ['Junior', 'Mid', 'Senior'],
  },
  [InterviewCompany.AMAZON]: {
    company: InterviewCompany.AMAZON,
    displayName: 'Amazon',
    focusInstructions: 'Strong focus on Amazon Leadership Principles (such as Customer Obsession, Ownership, Bias for Action, Dive Deep, and Invent and Simplify). Coding questions emphasize Medium-Hard Data Structures and Algorithms. Behavioral questions must follow the STAR format strictly, with deep follow-up probing questions into tradeoffs and ownership.',
    codingFocusSkills: ['Arrays', 'Graphs', 'HashMap', 'Trees', 'Dynamic Programming'],
    codingDifficultyProgression: 'Medium to Hard',
    roundStructure: ['CODING', 'TECHNICAL', 'BEHAVIORAL'],
    behavioralEvaluationCriteria: ['Customer Obsession', 'Ownership', 'Bias for Action', 'Dive Deep'],
    technicalEvaluationCriteria: ['Leadership & Ownership', 'Customer Focus', 'Technical Depth', 'Data Structures'],
    hiringLevels: ['SDE I (L4)', 'SDE II (L5)', 'Senior SDE (L6)', 'Principal SDE (L7)'],
  },
  [InterviewCompany.GOOGLE]: {
    company: InterviewCompany.GOOGLE,
    displayName: 'Google',
    focusInstructions: 'Extreme focus on algorithmic efficiency, optimization, mathematical edge cases, and logical follow-up reasoning. Emphasize communication, explaining time and space complexity upfront, and writing clean, optimal code with robust test cases.',
    codingFocusSkills: ['Algorithms', 'Graphs', 'Dynamic Programming', 'Recursion', 'Tries'],
    codingDifficultyProgression: 'Hard ONLY',
    roundStructure: ['CODING', 'TECHNICAL', 'BEHAVIORAL'],
    behavioralEvaluationCriteria: ['Googleyness', 'Leadership', 'Navigating Ambiguity', 'Teamwork'],
    technicalEvaluationCriteria: ['Algorithms & Optimization', 'Communication', 'Reasoning & Complexity', 'Edge Case Handling'],
    hiringLevels: ['SWE II (L3)', 'SWE III (L4)', 'Senior SWE (L5)', 'Staff SWE (L6)'],
  },
  [InterviewCompany.MICROSOFT]: {
    company: InterviewCompany.MICROSOFT,
    displayName: 'Microsoft',
    focusInstructions: 'Focus on Object-Oriented Design (OOD), solid architecture, cloud concepts, clean maintainable code, and practical software engineering problem solving. Look for growth mindset and a systematic, structured approach to building systems.',
    codingFocusSkills: ['OOP', 'Design Patterns', 'Trees', 'Strings', 'System Design'],
    codingDifficultyProgression: 'Medium to Hard',
    roundStructure: ['CODING', 'TECHNICAL', 'BEHAVIORAL'],
    behavioralEvaluationCriteria: ['Growth Mindset', 'Collaboration', 'Problem Solving', 'Customer Focus'],
    technicalEvaluationCriteria: ['OOP & Architecture', 'Maintainability & Clean Coding', 'Problem Solving', 'Design Tradeoffs'],
    hiringLevels: ['SDE (Level 59-60)', 'SDE II (Level 61-62)', 'Senior SDE (Level 63-64)', 'Principal SDE (Level 65+)'],
  },
  [InterviewCompany.FLIPKART]: {
    company: InterviewCompany.FLIPKART,
    displayName: 'Flipkart',
    focusInstructions: 'Backend systems, high scale, caching, relational and non-relational database design, concurrency, Java, Spring Boot, Redis, and overall system scalability.',
    codingFocusSkills: ['Caching', 'Concurrency', 'Design Patterns', 'Queues', 'Hashing'],
    codingDifficultyProgression: 'Medium to Hard',
    roundStructure: ['CODING', 'TECHNICAL'],
    behavioralEvaluationCriteria: ['Ownership', 'Execution Speed', 'Scaling Challenges', 'Collaboration'],
    technicalEvaluationCriteria: ['Scalability', 'Backend Engineering', 'Database Design', 'System Architecture'],
    hiringLevels: ['SDE I', 'SDE II', 'Senior SDE (SDE III)', 'Architect'],
  },
  [InterviewCompany.ADOBE]: {
    company: InterviewCompany.ADOBE,
    displayName: 'Adobe',
    focusInstructions: 'Strong focus on frontend software quality, UI/UX, browser internals, DOM manipulation, core JavaScript/TypeScript performance, and responsive frontend systems built using React.',
    codingFocusSkills: ['JavaScript', 'DOM manipulation', 'React', 'CSS Layouts', 'Event Loop'],
    codingDifficultyProgression: 'Easy to Medium',
    roundStructure: ['CODING', 'TECHNICAL', 'BEHAVIORAL'],
    behavioralEvaluationCriteria: ['Creativity', 'Product Thinking', 'User Empathy', 'Collaboration'],
    technicalEvaluationCriteria: ['Frontend Quality', 'UI/UX Polish', 'Performance & Speed', 'Core JS Internals'],
    hiringLevels: ['MTS I', 'MTS II', 'Senior MTS', 'Computer Scientist'],
  },
  [InterviewCompany.ATLASSIAN]: {
    company: InterviewCompany.ATLASSIAN,
    displayName: 'Atlassian',
    focusInstructions: 'Focus on distributed systems, clean REST API design, collaboration, scaling enterprise applications, system robustness, and values-based behavioral questions.',
    codingFocusSkills: ['API Design', 'System Design', 'Concurrency', 'Rate Limiting', 'Strings'],
    codingDifficultyProgression: 'Medium to Hard',
    roundStructure: ['CODING', 'TECHNICAL', 'BEHAVIORAL'],
    behavioralEvaluationCriteria: ['Open Company No Bullshit', 'Build with Heart and Balance', 'Play as a Team', 'Be the Change You Seek'],
    technicalEvaluationCriteria: ['API Design', 'Collaboration', 'System Design & Tradeoffs', 'Reliability'],
    hiringLevels: ['P3 (Associate)', 'P4 (Engineer)', 'P5 (Senior)', 'P6 (Principal)'],
  },
  [InterviewCompany.UBER]: {
    company: InterviewCompany.UBER,
    displayName: 'Uber',
    focusInstructions: 'Extremely high concurrency, low latency, real-time tracking, geospatial indexing, memory-optimized algorithms, and distributed queue systems.',
    codingFocusSkills: ['Concurrency', 'Geospatial Indexing', 'Graph Algorithms', 'Multithreading', 'Low Latency Designs'],
    codingDifficultyProgression: 'Hard ONLY',
    roundStructure: ['CODING', 'TECHNICAL'],
    behavioralEvaluationCriteria: ['Bias for Action', 'Ownership', 'Logical Execution', 'Teamwork'],
    technicalEvaluationCriteria: ['Concurrency & Scale', 'Algorithmic Efficiency', 'Low Latency Handling', 'Resiliency'],
    hiringLevels: ['Software Engineer II (L4)', 'Senior Engineer (L5)', 'Staff Engineer (L6)'],
  },
  [InterviewCompany.GOLDMAN_SACHS]: {
    company: InterviewCompany.GOLDMAN_SACHS,
    displayName: 'Goldman Sachs',
    focusInstructions: 'Strong focus on core Java, multithreading, advanced collections, memory management, SQL queries, system design, and algorithmic problem solving.',
    codingFocusSkills: ['Java Collections', 'Multithreading', 'SQL Queries', 'Binary Trees', 'Math & Probability'],
    codingDifficultyProgression: 'Medium to Hard',
    roundStructure: ['CODING', 'TECHNICAL'],
    behavioralEvaluationCriteria: ['Teamwork', 'Integrity', 'Client Service', 'Problem Solving'],
    technicalEvaluationCriteria: ['Multithreading & Collections', 'SQL / Database Querying', 'Robustness & Edge Cases', 'Mathematical Precision'],
    hiringLevels: ['Analyst', 'Associate', 'Vice President (VP)'],
  },
  [InterviewCompany.SALESFORCE]: {
    company: InterviewCompany.SALESFORCE,
    displayName: 'Salesforce',
    focusInstructions: 'Focus on enterprise software architectures, Java, multitenancy design patterns, CRM workflows, secure API development, and Apex concepts.',
    codingFocusSkills: ['Apex patterns', 'Java Collections', 'System Design', 'Caching', 'Security & ACLs'],
    codingDifficultyProgression: 'Medium to Hard',
    roundStructure: ['CODING', 'TECHNICAL', 'BEHAVIORAL'],
    behavioralEvaluationCriteria: ['Trust & Integrity', 'Customer Success', 'Innovation', 'Equality'],
    technicalEvaluationCriteria: ['Enterprise Patterns', 'Apex & Java Concepts', 'Backend Systems Design', 'Security Principles'],
    hiringLevels: ['AMTS', 'MTS', 'Senior MTS', 'Lead MTS', 'Principal Engineer'],
  },
};
