export interface WidgetConfig {
  titleText: string;
  accentColor: string;
  starColor: string;
  starBgColor: string;
  starIconUrl: string;
  textColor: string;
  mutedColor: string;
  bgColor: string;
  bgAltColor: string;
  borderColor: string;
  verifiedColor: string;
  radius: number;
  autoApprove: boolean;
  showTitle: boolean;
  showDate: boolean;
  showFilter: boolean;
  showSort: boolean;
  emailDisplay: 'hidden' | 'mask' | 'full';
  phoneDisplay: 'hidden' | 'mask' | 'full';
  formEmailMode: 'hidden' | 'optional' | 'required';
  formPhoneMode: 'hidden' | 'optional' | 'required';
  formTitleMode: 'hidden' | 'optional' | 'required';
  formContentMode: 'hidden' | 'optional' | 'required';
  formContentRequired?: boolean;
  reviewLayout: 'list' | 'grid' | 'masonry';
  reviewItemsPerPage: number;
  allowImage: boolean;
  allowVideo: boolean;
  allowQnA: boolean;
  qnaDisplayMode: 'list' | 'grid';
  qnaItemsPerPage: number;
  allowReply: boolean;
  replyBadgeText: string;
  replyBgColor: string;
  replyBorderColor: string;
  showVerified: boolean;
  showVerifiedAll: boolean;
  requireLogin: boolean;
}

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  titleText: 'Đánh giá sản phẩm',
  accentColor: '#f59e0b',
  starColor: '#f59e0b',
  starBgColor: '#b3bcc5',
  starIconUrl: '',
  textColor: '#1a1a1a',
  mutedColor: '#6b7280',
  bgColor: '#ffffff',
  bgAltColor: '#f8fafc',
  borderColor: '#e5e7eb',
  verifiedColor: '#01ab56',
  radius: 12,
  autoApprove: false,
  showTitle: true,
  showDate: true,
  showFilter: true,
  showSort: true,
  emailDisplay: 'mask',
  phoneDisplay: 'mask',
  formEmailMode: 'optional',
  formPhoneMode: 'hidden',
  formTitleMode: 'optional',
  formContentMode: 'optional',
  reviewLayout: 'list',
  reviewItemsPerPage: 5,
  allowImage: true,
  allowVideo: true,
  allowQnA: true,
  qnaDisplayMode: 'list',
  qnaItemsPerPage: 5,
  allowReply: true,
  replyBadgeText: 'Phản hồi từ Shop',
  replyBgColor: '#f0f5ff',
  replyBorderColor: '#1677ff',
  showVerified: true,
  showVerifiedAll: false,
  requireLogin: false,
};
