import { PrismaClient, UserRole, ExperienceLevel, CodingDifficulty } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with initial development data...');

  // 1. Seed Development Candidate User
  const candidateEmail = 'candidate@example.com';
  let candidate = await prisma.user.findUnique({
    where: { email: candidateEmail },
  });

  if (!candidate) {
    candidate = await prisma.user.create({
      data: {
        email: candidateEmail,
        // Simulated hash of 'password123'
        passwordHash: '$2b$10$EPf9jKbV2gEaMskH5JpWeuE6p6B.yF9V9.aX3K8v9fE6aMskH5JpW',
        role: UserRole.CANDIDATE,
        emailVerified: true,
        profile: {
          create: {
            fullName: 'John Doe',
            headline: 'Full Stack Software Engineer',
            bio: 'Passionate developer with 3 years of experience building modern Node.js and React applications.',
            experienceLevel: ExperienceLevel.MID_LEVEL,
            targetRoles: ['Full Stack Developer', 'Software Engineer', 'Backend Engineer'],
          },
        },
      },
    });
    console.log(`Created dev candidate user: ${candidateEmail}`);
  } else {
    console.log(`Dev candidate user already exists: ${candidateEmail}`);
  }

  // 2. Seed System Reusable Coding Problems
  const problems = [
    {
      title: 'Two Sum',
      slug: 'two-sum',
      description: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
      difficulty: CodingDifficulty.EASY,
      constraints: [
        '2 <= nums.length <= 10^4',
        '-10^9 <= nums[i] <= 10^9',
        '-10^9 <= target <= 10^9',
      ],
      examples: [
        {
          input: 'nums = [2,7,11,15], target = 9',
          output: '[0,1]',
          explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
        },
      ],
      starterCode: {
        JAVASCRIPT: 'function twoSum(nums, target) {\n  // Write your code here\n}',
        TYPESCRIPT: 'function twoSum(nums: number[], target: number): number[] {\n  // Write your code here\n}',
        PYTHON: 'def twoSum(nums: List[int], target: int) -> List[int]:\n    # Write your code here\n    pass',
      },
    },
    {
      title: 'Reverse String',
      slug: 'reverse-string',
      description: 'Write a function that reverses a string. The input string is given as an array of characters `s`. You must do this by modifying the input array in-place with O(1) extra memory.',
      difficulty: CodingDifficulty.EASY,
      constraints: [
        '1 <= s.length <= 10^5',
        's[i] is a printable ascii character.',
      ],
      examples: [
        {
          input: 's = ["h","e","l","l","o"]',
          output: '["o","l","l","e","h"]',
        },
      ],
      starterCode: {
        JAVASCRIPT: 'function reverseString(s) {\n  // Write your code here\n}',
        TYPESCRIPT: 'function reverseString(s: string[]): void {\n  // Write your code here\n}',
        PYTHON: 'def reverseString(s: List[str]) -> None:\n    # Write your code here\n    pass',
      },
    },
  ];

  for (const prob of problems) {
    const existing = await prisma.codingProblem.findUnique({
      where: { slug: prob.slug },
    });

    if (!existing) {
      await prisma.codingProblem.create({
        data: prob,
      });
      console.log(`Created coding problem: ${prob.title}`);
    } else {
      console.log(`Coding problem already exists: ${prob.title}`);
    }
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
