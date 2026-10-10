import { useState, useEffect } from 'react';
import { Bell, X, AlertCircle, CheckCircle, Info, AlertTriangle, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: string;
  product_id?: string;
  product_name?: string;
}

export default function NotificationPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadPolicyViolationNotifications();
  }, []);

  async function loadPolicyViolationNotifications() {
    const { data: violations, error } = await supabase
      .from('product_policy_evaluations')
      .select(`
        id,
        product_id,
        violation_details,
        evaluated_at,
        products (name),
        product_policies (display_name, severity)
      `)
      .eq('status', 'violation')
      .order('evaluated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error loading policy violations:', error);
      return;
    }

    const policyNotifications: Notification[] = (violations || []).map((v: any) => ({
      id: v.id,
      title: `Policy Violation: ${v.product_policies?.display_name || 'Unknown Policy'}`,
      message: `${v.products?.name || 'Product'} - ${v.violation_details?.message || 'Policy violation detected'}`,
      type: v.product_policies?.severity === 'error' ? 'error' : 'warning',
      is_read: false,
      created_at: v.evaluated_at,
      product_id: v.product_id,
      product_name: v.products?.name
    }));

    setNotifications(policyNotifications);
    setUnreadCount(policyNotifications.filter(n => !n.is_read).length);
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      default:
        return <Info className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowPanel(!showPanel)}
        aria-label="Notifications"
        className="relative"
      >
        <Bell className="!h-5 !w-5 text-brand" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPanel(false)}
                  aria-label="Close notifications"
                  className="h-8 w-8"
                >
                  <X />
                </Button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No notifications</p>
                  <p className="text-xs mt-2">Demo mode - notifications will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        !notification.is_read ? 'bg-sky-50/50 dark:bg-sky-900/20' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                              {notification.title}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 p-3">
              <Button
                variant="ghost"
                onClick={() => {
                  loadPolicyViolationNotifications();
                }}
                className="w-full"
              >
                <Settings />
                Refresh notifications
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
