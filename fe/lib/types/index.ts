export enum AppView {
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  DASHBOARD = 'DASHBOARD',
  SETTINGS = 'SETTINGS',
  SUBJECTS = 'SUBJECTS',
  CHAT_TUTOR = 'CHAT_TUTOR',
  FLASHCARDS = 'FLASHCARDS',
  CASES = 'CASES',
  STATUTES = 'STATUTES',
  SCENARIO = 'SCENARIO',
  PLANNER = 'PLANNER',
}

export interface UserStats {
  streakDays: number;
}
