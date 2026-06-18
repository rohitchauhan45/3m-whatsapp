export interface BrandConfig {
  name: string;
  primaryColor: string;
  primaryColorDark: string;
}

export interface OverlayConfig {
  title: string;
  description: string;
  backgroundColor: string;
  textColor: string;
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center';
  showCarousel: boolean;
  currentSlide: number;
  totalSlides: number;
}

export interface LeftColumnConfig {
  image: string;
  overlay: OverlayConfig;
}

export interface LoginFormConfig {
  title: string;
  newUserText: string;
  signUpLinkText: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  rememberMeText: string;
  forgotPasswordText: string;
  submitButtonText: string;
  submitButtonLoadingText: string;
  orSeparatorText: string;
  googleSignInText: string;
  googleSignInShowUser: boolean;
  googleSignInUserName?: string;
  googleSignInUserEmail?: string;
}

export interface SignupFormConfig {
  title: string;
  existingUserText: string;
  signInLinkText: string;
  nameLabel: string;
  namePlaceholder: string;
  numberLabel: string;
  numberPlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint: string;
  submitButtonText: string;
  submitButtonLoadingText: string;
  orSeparatorText: string;
  googleSignUpText: string;
  googleSignUpShowUser: boolean;
  googleSignUpUserName?: string;
  googleSignUpUserEmail?: string;
  termsText: string;
  termsLinkText: string;
  privacyLinkText: string;
}

export interface ForgotPasswordFormConfig {
  title: string;
  subtitle: string;
  subtitleSent: string;
  emailLabel: string;
  emailPlaceholder: string;
  submitButtonText: string;
  submitButtonLoadingText: string;
  rememberedPasswordText: string;
  backToSignInText: string;
  successMessage: string;
  useDifferentEmailText: string;
  resendLinkText: string;
  returnToSignInText: string;
}

export interface ResetPasswordFormConfig {
  title: string;
  subtitle: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  submitButtonText: string;
  submitButtonLoadingText: string;
  successTitle: string;
  successMessage: string;
  backToSignInText: string;
  missingTokenMessage: string;
  requestNewLinkText: string;
}

export interface RightColumnConfig {
  login: LoginFormConfig;
  signup: SignupFormConfig;
  forgotPassword: ForgotPasswordFormConfig;
  resetPassword: ResetPasswordFormConfig;
}

export interface AuthConfig {
  brand: BrandConfig;
  leftColumn: LeftColumnConfig;
  rightColumn: RightColumnConfig;
}

