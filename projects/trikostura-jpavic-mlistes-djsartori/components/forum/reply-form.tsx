'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/forum/markdown-editor';
import { AdvancedFileUpload } from '@/components/forum/advanced-file-upload';
import { createClient } from '@/lib/supabase/client';
import { uploadAttachment, saveAttachmentMetadata } from '@/lib/attachments';
import { processMentions } from '@/app/forum/actions';
import { detectSpam, detectDuplicate, detectRapidPosting } from '@/lib/spam-detection';
import { checkAndAwardAchievements } from '@/app/forum/achievements/actions';
import { moderateContent } from '@/lib/content-moderation';
import { useTypingIndicator } from '@/components/forum/typing-indicator';
import { toast } from 'sonner';
import { Send, Loader2, Smile, Eye, Edit3, Lightbulb, X, Zap, Quote, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useButtonAnimation } from '@/hooks/use-button-animation';
import { MarkdownRenderer } from '@/components/forum/markdown-renderer';

interface ReplyFormProps {
  topicId: string;
  quotedText?: string;
  quotedAuthor?: string;
  onSuccess?: () => void;
  onClearQuote?: () => void;
}

const MAX_CONTENT_LENGTH = 10000;
type NoticeKind = 'info' | 'success' | 'warning' | 'error';

// Common emojis for quick access
const QUICK_EMOJIS = ['👍', '👎', '😊', '😂', '❤️', '🎉', '🤔', '👏', '🔥', '💯'];

export function ReplyForm({ topicId, quotedText, quotedAuthor, onSuccess, onClearQuote }: ReplyFormProps) {
  const [content, setContent] = useState(quotedText ? `> ${quotedText.split('\n').join('\n> ')}\n\n@${quotedAuthor} ` : '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [statusNotice, setStatusNotice] = useState<{ type: NoticeKind; message: string } | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialContentRef = useRef(content);
  const lastSavedContentRef = useRef(content);
  const { triggerAnimation, animationClasses } = useButtonAnimation();
  const draftKey = useMemo(() => `reply-draft-${topicId}`, [topicId]);
  const draftSavedAtKey = useMemo(() => `${draftKey}-savedAt`, [draftKey]);
  
  // Typing indicator hook
  const { broadcastTyping, stopTyping } = useTypingIndicator(topicId, currentUserId);

  // Get current user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  // Restore draft from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(draftKey);
    const savedAt = localStorage.getItem(draftSavedAtKey);

    if (stored && stored.trim()) {
      setContent(stored);
      initialContentRef.current = stored;
      lastSavedContentRef.current = stored;
      setLastSavedAt(savedAt ? new Date(savedAt) : new Date());
      setStatusNotice({ type: 'info', message: 'Vratili smo tvoj nedavno spremljeni nacrt odgovora.' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, draftSavedAtKey]);

  // Autosave draft every 8s when there are unsaved changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges && content.trim()) {
        const savedAt = new Date();
        localStorage.setItem(draftKey, content);
        localStorage.setItem(draftSavedAtKey, savedAt.toISOString());
        lastSavedContentRef.current = content;
        setLastSavedAt(savedAt);

        // If only text changed and no files are pending, mark as saved
        if (selectedFiles.length === 0) {
          setHasUnsavedChanges(false);
        }
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, content, draftKey, draftSavedAtKey, selectedFiles.length]);

  // Broadcast typing when content changes
  useEffect(() => {
    if (content.trim() && content !== initialContentRef.current) {
      broadcastTyping();
    }
  }, [content, broadcastTyping]);

  // Update content when quote is added
  useEffect(() => {
    if (quotedText && quotedAuthor) {
      const quotedContent = `> ${quotedText.split('\n').join('\n> ')}\n\n@${quotedAuthor} `;
      setContent(quotedContent);
      initialContentRef.current = quotedContent;
      // Focus on textarea after quote is inserted
      setTimeout(() => {
        textareaRef.current?.focus();
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      }, 100);
    }
  }, [quotedText, quotedAuthor]);

  // Track unsaved changes
  useEffect(() => {
    const baseline = lastSavedContentRef.current.trim();
    const trimmed = content.trim();
    setHasUnsavedChanges(trimmed !== baseline || selectedFiles.length > 0);
  }, [content, selectedFiles]);

  // Clear draft storage when form is empty
  useEffect(() => {
    if (!content.trim() && selectedFiles.length === 0) {
      localStorage.removeItem(draftKey);
      localStorage.removeItem(draftSavedAtKey);
      lastSavedContentRef.current = '';
      setLastSavedAt(null);
      setHasUnsavedChanges(false);
    }
  }, [content, selectedFiles.length, draftKey, draftSavedAtKey]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && content.trim()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, content]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const validateContent = useCallback(() => {
    if (!content.trim()) {
      const message = 'Sadržaj odgovora ne može biti prazan';
      toast.error(message);
      setStatusNotice({ type: 'error', message });
      textareaRef.current?.focus();
      return false;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      const message = `Sadržaj ne smije biti duži od ${MAX_CONTENT_LENGTH} znakova`;
      toast.error(message);
      setStatusNotice({ type: 'error', message });
      return false;
    }

    setStatusNotice(null);
    return true;
  }, [content]);

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + emoji + content.substring(end);

    setContent(newContent);

    // Restore cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + emoji.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setStatusNotice(null);

    if (!validateContent()) {
      return;
    }

    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const toastId = toast.loading('Objavljujem odgovor...');

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const message = 'Morate biti prijavljeni';
        toast.error(message, { id: toastId });
        setStatusNotice({ type: 'error', message });
        setIsSubmitting(false);
        return;
      }

      // Spam detection - check content
      const spamCheck = detectSpam(content.trim());
      if (spamCheck.isSpam) {
        const message = `Sadržaj je označen kao spam: ${spamCheck.reason}`;
        toast.error(message, { id: toastId });
        setStatusNotice({ type: 'error', message });
        setIsSubmitting(false);
        return;
      }

      // Fetch recent posts by this user for duplicate/rate limit checks
      const { data: recentReplies } = await (supabase as any)
        .from('replies')
        .select('content, created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentReplies && recentReplies.length > 0) {
        // Check for duplicate content
        const duplicateCheck = detectDuplicate({
          content: content.trim(),
          userId: user.id,
          recentPosts: recentReplies,
          timeWindowMinutes: 5,
        });

        if (duplicateCheck.isSpam) {
          const message = `${duplicateCheck.reason}. Molimo pričekajte prije ponovnog objavljivanja.`;
          toast.error(message, { id: toastId });
          setStatusNotice({ type: 'warning', message });
          setIsSubmitting(false);
          return;
        }

        // Check for rapid posting
        const rateCheck = detectRapidPosting({
          userId: user.id,
          recentPosts: recentReplies,
          maxPostsPerMinute: 3,
        });

        if (rateCheck.isSpam) {
          const message = `${rateCheck.reason}. Molimo usporite.`;
          toast.error(message, { id: toastId });
          setStatusNotice({ type: 'warning', message });
          setIsSubmitting(false);
          return;
        }
      }

      // Content moderation - check for inappropriate content
      const moderationResult = await moderateContent({
        content: content.trim(),
        userId: user.id,
        contentType: 'reply',
      });

      if (!moderationResult.approved) {
        const message = moderationResult.reason || 'Sadržaj sadrži neprimjeren jezik';
        toast.error(message, { id: toastId });
        setStatusNotice({ type: 'error', message });
        setIsSubmitting(false);
        return;
      }

      // Use moderated content (censored if needed)
      const finalContent = moderationResult.content || content.trim();

      const { error: insertError, data: newReply } = await (supabase as any)
        .from('replies')
        .insert({
          content: finalContent,
          topic_id: topicId,
          author_id: user.id,
          auto_flagged: moderationResult.severity ? true : false,
          moderation_status: moderationResult.severity && moderationResult.severity !== 'low' ? 'flagged' : 'approved',
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Upload attachments with progress
      if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const progress = ((i + 1) / selectedFiles.length) * 100;
          setUploadProgress(progress);

          toast.loading(`Učitavam datoteke... (${i + 1}/${selectedFiles.length})`, { id: toastId });

          const { url, error: uploadError } = await uploadAttachment(file, user.id);

          if (uploadError || !url) {
            console.error('Failed to upload file:', file.name, uploadError);
            toast.warning(`Nije uspjelo učitavanje: ${file.name}`);
            continue;
          }

          await saveAttachmentMetadata(
            url,
            file.name,
            file.size,
            file.type,
            user.id,
            newReply.id,
            'reply'
          );
        }
      }

      // Process mentions and create notifications
      await processMentions(content.trim(), user.id, topicId, newReply.id);

      // Check and award achievements
      const newAchievements = await checkAndAwardAchievements(user.id);

      // Show achievement notifications
      if (newAchievements && newAchievements.length > 0) {
        const { ACHIEVEMENTS } = await import('@/lib/achievements-definitions');
        newAchievements.forEach(achievementId => {
          const achievement = ACHIEVEMENTS[achievementId];
          if (achievement) {
            toast.success(`🏆 Novo postignuće: ${achievement.name}!`, {
              description: achievement.description,
              duration: 5000,
            });
          }
        });
      }

      triggerAnimation();
      toast.success('Odgovor uspješno objavljen!', { id: toastId });
      setStatusNotice({ type: 'success', message: 'Odgovor objavljen i nacrt očišćen.' });

      // Reset form
      setContent('');
      setSelectedFiles([]);
      setHasUnsavedChanges(false);
      setIsSubmitting(false);
      setUploadProgress(0);
      initialContentRef.current = '';
      lastSavedContentRef.current = '';
      setLastSavedAt(null);
      localStorage.removeItem(draftKey);
      localStorage.removeItem(draftSavedAtKey);

      // Callback or refresh
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }

    } catch (error: any) {
      console.error('Reply submission error:', error);
      const message = error?.message || 'Greška pri objavljivanju odgovora';
      toast.error(message, { id: toastId });
      setStatusNotice({ type: 'error', message });

      // Save content to localStorage for recovery
      if (content.trim()) {
        const savedAt = new Date();
        localStorage.setItem(draftKey, content);
        localStorage.setItem(draftSavedAtKey, savedAt.toISOString());
        lastSavedContentRef.current = content;
        setLastSavedAt(savedAt);
        toast.info('Sadržaj spremljen u međuspremnik');
      }

      setIsSubmitting(false);
      setUploadProgress(0);
    }
  }

  const charactersLeft = useMemo(() => MAX_CONTENT_LENGTH - content.length, [content]);
  const isOverLimit = useMemo(() => charactersLeft < 0, [charactersLeft]);

  // Quick reply templates
  const applyTemplate = (template: string) => {
    setContent(template);
    toast.success('Predložak primijenjen!');
  };

  const replyTemplates = [
    {
      name: 'Hvala',
      template: 'Hvala na odgovoru! To mi je pomoglo da riješim problem. 👍',
    },
    {
      name: 'Dodatno pitanje',
      template: 'Hvala na objašnjenju! Imam još jedno pitanje:\n\n',
    },
    {
      name: 'Rješenje',
      template: '## Rješenje\n\nNašao sam rješenje! Evo što je uspjelo:\n\n1. \n2. \n\nNadam se da će ovo pomoći i drugima s istim problemom!',
    },
  ];

  const noticeStyles: Record<NoticeKind, string> = {
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100',
    success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100',
    error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100',
  };

  const renderNoticeIcon = (type: NoticeKind) => {
    if (type === 'success') return <CheckCircle2 className="w-4 h-4 mt-0.5" />;
    if (type === 'warning') return <AlertTriangle className="w-4 h-4 mt-0.5" />;
    if (type === 'error') return <AlertTriangle className="w-4 h-4 mt-0.5" />;
    return <Info className="w-4 h-4 mt-0.5" />;
  };

  const handleClearQuote = () => {
    setContent('');
    if (onClearQuote) {
      onClearQuote();
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* Quote Indicator */}
      {quotedText && quotedAuthor && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
          <Quote className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">
              Citiraš {quotedAuthor}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
              {quotedText}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearQuote}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Ukloni citat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tips Panel */}
      {showTips && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Savjeti za dobar odgovor
                </h4>
              </div>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Budi jasan i koncizan u odgovoru</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Koristi primjere koda ako je primjenjivo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>Provjeri svoj odgovor u pregledu prije objave</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setShowTips(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Zatvori savjete"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {/* Header with Preview Toggle and Templates */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {!showTips && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTips(true)}
                className="text-xs h-7"
              >
                <Lightbulb className="w-3 h-3 mr-1" />
                Savjeti
              </Button>
            )}
            {!content && replyTemplates.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-gray-500 dark:text-gray-400">Brzi odgovor:</span>
                {replyTemplates.map((tpl) => (
                  <Button
                    key={tpl.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(tpl.template)}
                    className="text-xs h-7"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    {tpl.name}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPreviewMode(false)}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                !isPreviewMode
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              Uredi
            </button>
            <button
              type="button"
              onClick={() => setIsPreviewMode(true)}
              className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                isPreviewMode
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Eye className="w-3 h-3" />
              Pregled
            </button>
          </div>
        </div>

        {isPreviewMode ? (
          <div className="min-h-[150px] max-h-[400px] overflow-y-auto p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
            {content ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Nema sadržaja za prikaz. Pređi na način uređivanja da napišeš odgovor.
              </p>
            )}
          </div>
        ) : (
          <div className="relative">
            <MarkdownEditor
              ref={textareaRef}
              value={content}
              onChange={setContent}
              placeholder="Napiši svoj odgovor... (Markdown podržan) • Ctrl+Enter za objavu"
              rows={6}
            />

            {/* Emoji Picker Button */}
            <div className="absolute bottom-2 right-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="h-8 w-8 p-0"
                title="Dodaj emoji"
              >
                <Smile className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Quick Emoji Picker */}
        {showEmojiPicker && (
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  insertEmoji(emoji);
                  setShowEmojiPicker(false);
                }}
                className="text-2xl hover:scale-125 transition-transform"
                title={`Dodaj ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Character Counter */}
        <div className="flex justify-between items-center text-sm flex-wrap gap-2">
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <span>Markdown podržan</span>
            {hasUnsavedChanges && (
              <span className="text-orange-600 dark:text-orange-400">
                • Nespremljene promjene
              </span>
            )}
            {lastSavedAt && (
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                Auto-spremljeno u {lastSavedAt.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <span className={`font-medium ${isOverLimit ? 'text-red-600 dark:text-red-400' : charactersLeft < 100 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {isOverLimit ? `${Math.abs(charactersLeft)} preko limita` : `${charactersLeft.toLocaleString()} preostalo`}
          </span>
        </div>
      </div>

      {statusNotice && (
        <div className={`flex items-start gap-3 text-sm rounded-md border p-3 ${noticeStyles[statusNotice.type]}`}>
          {renderNoticeIcon(statusNotice.type)}
          <p className="flex-1 leading-snug">{statusNotice.message}</p>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-inherit hover:opacity-70"
            aria-label="Zatvori obavijest"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <AdvancedFileUpload onFilesChange={setSelectedFiles} maxFiles={3} />

      {/* Upload Progress */}
      {isSubmitting && uploadProgress > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Učitavanje datoteka...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || isOverLimit}
          className={`min-w-[160px] ${animationClasses}`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Objavljujem...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Objavi odgovor
            </>
          )}
        </Button>
      </div>

      {/* Keyboard Shortcut Hint */}
      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        Savjet: Pritisni <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">Ctrl</kbd> + <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">Enter</kbd> za brzu objavu
      </p>
    </form>
  );
}
