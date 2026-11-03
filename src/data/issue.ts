import type { Issue, Verification } from '../types'

export function issueId(year: number, numbers: number[]): string {
  return `${year}-${numbers.join('-')}`
}

export function issueLabel(numbers: number[]): string {
  return `${numbers.join('・')}号`
}

export function makeIssue(year: number, numbers: number[], verification: Verification): Issue {
  const sorted = [...numbers].sort((a, b) => a - b)
  return { id: issueId(year, sorted), year, numbers: sorted, verification }
}

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => a.numbers[0] - b.numbers[0])
}
