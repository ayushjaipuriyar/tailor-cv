"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/components/ui/card";

interface Keywords {
    skills: string[];
    qualifications: string[];
    other: string[];
}

interface KeywordExtractorProps {
    text: string;
}

export function KeywordExtractor({ text }: KeywordExtractorProps) {
    const [keywords, setKeywords] = useState<Keywords>({
        skills: [],
        qualifications: [],
        other: [],
    });

    useEffect(() => {
        if (!text || text.length < 50) {
            setKeywords({ skills: [], qualifications: [], other: [] });
            return;
        }

        const extracted = extractKeywords(text);
        setKeywords(extracted);
    }, [text]);

    const extractKeywords = (text: string): Keywords => {
        const lowerText = text.toLowerCase();

        // Common technical skills and tools
        const techKeywords = [
            'javascript', 'typescript', 'python', 'java', 'c\\+\\+', 'c#', 'ruby', 'go', 'rust', 'php',
            'react', 'vue', 'angular', 'node\\.?js', 'express', 'django', 'flask', 'spring', 'laravel', 'next\\.?js',
            'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'ci/cd', 'terraform', 'ansible',
            'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'dynamodb',
            'git', 'github', 'gitlab', 'jira', 'agile', 'scrum', 'devops', 'sre', 'mlops',
            'rest', 'graphql', 'api', 'microservices', 'serverless', 'lambda',
            'html', 'css', 'sass', 'tailwind', 'bootstrap', 'material[- ]ui',
            'webpack', 'vite', 'babel', 'npm', 'yarn', 'pnpm', 'turbo',
            'jest', 'mocha', 'cypress', 'selenium', 'testing', 'tdd', 'bdd',
            'linux', 'unix', 'bash', 'shell', 'scripting', 'powershell',
            'machine learning', 'ml', 'ai', 'deep learning', 'nlp', 'computer vision',
            'data science', 'analytics', 'big data', 'spark', 'hadoop', 'kafka',
            'blockchain', 'web3', 'solidity', 'smart contracts'
        ];

        // Qualifications and experience
        const qualificationKeywords = [
            'bachelor', 'master', 'phd', 'degree', 'certification', 'certified',
            '\\d+\\+?\\s*years?', 'experience', 'senior', 'junior', 'lead', 'principal', 'staff',
            'b\\.?s\\.?', 'm\\.?s\\.?', 'b\\.?tech', 'm\\.?tech', 'mba'
        ];

        // Soft skills and other keywords
        const softSkillKeywords = [
            'leadership', 'communication', 'teamwork', 'problem[- ]solving',
            'analytical', 'critical thinking', 'collaboration', 'mentoring', 'coaching',
            'remote', 'hybrid', 'on[- ]site', 'full[- ]time', 'part[- ]time', 'contract',
            'startup', 'enterprise', 'fast[- ]paced', 'innovative'
        ];

        const skills: string[] = [];
        const qualifications: string[] = [];
        const other: string[] = [];

        // Extract technical skills
        techKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = text.match(regex);
            if (matches) {
                const normalized = matches[0].toLowerCase();
                if (!skills.includes(normalized)) {
                    skills.push(normalized);
                }
            }
        });

        // Extract qualifications
        qualificationKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = text.match(regex);
            if (matches) {
                matches.forEach(match => {
                    if (!qualifications.includes(match)) {
                        qualifications.push(match);
                    }
                });
            }
        });

        // Extract soft skills
        softSkillKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = text.match(regex);
            if (matches) {
                const normalized = matches[0].toLowerCase();
                if (!other.includes(normalized)) {
                    other.push(normalized);
                }
            }
        });

        return {
            skills: skills.slice(0, 20), // Top 20
            qualifications: qualifications.slice(0, 5),
            other: other.slice(0, 10)
        };
    };

    const hasKeywords = keywords.skills.length > 0 || keywords.qualifications.length > 0 || keywords.other.length > 0;

    if (!hasKeywords) {
        return null;
    }

    return (
        <Card className="bg-neutral-800/50 border-neutral-700 mt-3">
            <CardContent className="pt-4">
                <div className="text-sm">
                    <div className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
                        <span>🎯</span>
                        <span>Detected ATS Keywords</span>
                    </div>

                    {keywords.skills.length > 0 && (
                        <div className="mb-3">
                            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                                Technical Skills
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {keywords.skills.map((skill, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-block px-2.5 py-1 bg-blue-900/40 text-blue-300 rounded-full text-xs font-medium border border-blue-700/30"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {keywords.qualifications.length > 0 && (
                        <div className="mb-3">
                            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                                Qualifications
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {keywords.qualifications.map((qual, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-block px-2.5 py-1 bg-green-900/40 text-green-300 rounded-full text-xs font-medium border border-green-700/30"
                                    >
                                        {qual}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {keywords.other.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                                Other Keywords
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {keywords.other.map((item, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-block px-2.5 py-1 bg-purple-900/40 text-purple-300 rounded-full text-xs font-medium border border-purple-700/30"
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
