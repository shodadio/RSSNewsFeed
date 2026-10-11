import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { ArticleView } from './components/ArticleView';
import { AuthModal } from './components/AuthModal';
import { AddFeedModal } from './components/AddFeedModal';
import { SettingsModal } from './components/SettingsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Feed, Article, SmartFilter, AIBriefing } from './types';
import {
  getLocalFeeds,
  saveLocalFeeds,
  getLocalArticleState,
  saveLocalArticleState,
  getLocalCachedArticles,
  saveLocalCachedArticles,
  hasLocalUserData,
  getLocalDeletedFeedUrls,
  saveLocalDeletedFeedUrls
} from './utils/storage';
import { getAuthHeaders, AUTH_EXPIRED_EVENT } from './utils/api';
import { formatTag } from './utils/tagUtils';
