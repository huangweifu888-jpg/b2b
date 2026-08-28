import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Maximize2, X } from 'lucide-react';

import {
  resolveCenteredWindowResize,
  SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT,
  SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE,
  SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE,
  SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE,
  SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION,
  SHARED_SMALL_CARD_MARKER_POLICY,
  SHARED_SMALL_CARD_MARKER_RESOLUTION,
  SHARED_WINDOW_CONTRACT_VERSION,
  SHARED_WINDOW_FACTORY_DEFAULT,
  SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT,
  type SharedWindowResizeEdge,
} from '@/lib/shared-window-contract';
import { cn } from '@/lib/utils';

/**
 * One dialog frame contract for settings, workbenches, and lightweight
 * confirmations. Regions are optional, but every dialog has the same frame
 * and can therefore be styled and audited by the shared layout plugins.
 */
export const SHARED_DIALOG_WINDOW_CONTRACT = SHARED_WINDOW_CONTRACT_VERSION;

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-tradepro-dialog-overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface BaseDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean;
}

const SharedDialogCloseButton = () => (
  <DialogPrimitive.Close
    data-dialog-close
    data-development-standard-close
    data-content-plugin-control="close"
    data-shared-window-close="true"
    data-shared-window-title-action="close"
    className="content-plugin-action-button is-icon absolute right-4 top-4 z-40"
    aria-label="关闭"
  >
    <X className="h-4 w-4" />
    <span className="sr-only">关闭</span>
  </DialogPrimitive.Close>
);

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  BaseDialogContentProps
>(({ className, children, showCloseButton = true, style, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-shared-dialog-contract="generic-editor"
      data-shared-window-contract={SHARED_DIALOG_WINDOW_CONTRACT}
      data-shared-window-factory-default={SHARED_WINDOW_FACTORY_DEFAULT.id}
      data-shared-window-kind="editor"
      data-shared-window-region="frame"
      data-shared-window-content="implicit"
      data-shared-window-theme-projection="active-page"
      data-shared-window-title-action-contract={SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT}
      data-shared-window-small-card-marker-policy={SHARED_SMALL_CARD_MARKER_POLICY}
      data-shared-window-small-card-marker-contract={SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION}
      data-shared-window-small-card-marker-scope-attribute={SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE}
      data-shared-window-small-card-marker-resolution={SHARED_SMALL_CARD_MARKER_RESOLUTION}
      data-shared-window-small-card-marker-runtime-attribute={SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE}
      data-shared-window-small-card-surface-runtime-attribute={SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}
      className={cn(
        'tradepro-dialog-surface fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      style={{ "--tradepro-shared-dialog-title-action-inset": "1.5rem", ...style } as React.CSSProperties}
      {...props}
    >
      {children}
      {showCloseButton ? <SharedDialogCloseButton /> : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

interface DraggableDialogContentProps
  extends BaseDialogContentProps {
  dragHandleClassName?: string;
  edgeToEdge?: boolean;
  /** Renders as a regular in-page surface without portal, overlay, or dialog semantics. */
  inline?: boolean;
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  /** Makes expert identity content scale from this dialog's real resize state. */
  responsiveExpertProfile?: boolean;
}

type DialogResizeEdge = SharedWindowResizeEdge;

const DIALOG_RESIZE_EDGES: readonly DialogResizeEdge[] = [
  "north", "south", "east", "west", "north-east", "north-west", "south-east", "south-west",
];

const DraggableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DraggableDialogContentProps
>(
  (
    {
      className,
      children,
      dragHandleClassName,
      showCloseButton = true,
      edgeToEdge = false,
      inline = false,
      resizable = false,
      minWidth = 240,
      minHeight = 180,
      responsiveExpertProfile = false,
      style,
      ...props
    },
    ref
  ) => {
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);
    const [resizeEdge, setResizeEdge] = React.useState<DialogResizeEdge | null>(null);
    const dragStartRef = React.useRef({ x: 0, y: 0 });
    const posStartRef = React.useRef({ x: 0, y: 0 });
    const dragStartBoundsRef = React.useRef({ left: 0, right: 0, top: 0, bottom: 0 });
    const resizeStartRef = React.useRef({ pointerId: -1, x: 0, y: 0, left: 0, right: 0, top: 0, bottom: 0 });
    const contentRef = React.useRef<React.ElementRef<typeof DialogPrimitive.Content> | null>(null);
    const expertPopupScale = responsiveExpertProfile && size
      ? {
          "--tradepro-expert-popup-avatar-size": `${Math.round(Math.max(80, Math.min(240, size.width * 0.3, size.height * 0.44)))}px`,
          "--tradepro-expert-popup-copy-size": `${Math.round(Math.max(12, Math.min(20, size.width * 0.028)))}px`,
          "--tradepro-expert-popup-name-size": `${Math.round(Math.max(14, Math.min(24, size.width * 0.038)))}px`,
          "--tradepro-expert-popup-gap": `${Math.round(Math.max(8, Math.min(16, size.width * 0.02)))}px`,
        }
      : {};

    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent) => {
        if (edgeToEdge) return;
        const target = e.target as HTMLElement;
        if (target.closest('[data-resize-handle]')) return;
        // Only start drag from the header area (identified by dragHandleClassName or data-drag-handle)
        const handle = target.closest('[data-drag-handle]');
        if (!handle) return;
        // The shared drag plugin is itself a button.  It is intentionally the
        // one interactive control inside a dialog header that may start a
        // window drag; all other header buttons remain ordinary actions.
        const usesSharedDragPlugin = Boolean(target.closest('[data-dialog-drag-plugin="true"]'));
        // Don't drag if clicking on buttons or interactive elements inside the handle
        if (
          (target.closest('button') && !usesSharedDragPlugin) ||
          target.closest('input') ||
          target.closest('select')
        )
          return;
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        posStartRef.current = { x: position.x, y: position.y };
        const rect = contentRef.current?.getBoundingClientRect();
        if (rect) {
          dragStartBoundsRef.current = {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        }
      },
      [edgeToEdge, position]
    );

    React.useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const gutter = 8;
        const bounds = dragStartBoundsRef.current;
        const clampedDx = Math.min(
          Math.max(dx, gutter - bounds.left),
          window.innerWidth - gutter - bounds.right
        );
        const clampedDy = Math.min(
          Math.max(dy, gutter - bounds.top),
          window.innerHeight - gutter - bounds.bottom
        );
        setPosition({
          x: posStartRef.current.x + clampedDx,
          y: posStartRef.current.y + clampedDy,
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDragging]);

    const handleResizePointerDown = React.useCallback(
      (edge: DialogResizeEdge) => (e: React.PointerEvent<HTMLButtonElement>) => {
        if (!resizable || edgeToEdge) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = contentRef.current?.getBoundingClientRect();
        if (!rect) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        resizeStartRef.current = {
          pointerId: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
        setResizeEdge(edge);
      },
      [edgeToEdge, resizable]
    );

    React.useEffect(() => {
      if (!resizeEdge) return;

      const handlePointerMove = (e: PointerEvent) => {
        const start = resizeStartRef.current;
        if (e.pointerId !== start.pointerId) return;
        // Mouse pointers expose the pressed-button bit. Touch and pen input
        // keep resizing through pointer capture until pointerup/cancel.
        if (e.pointerType === "mouse" && (e.buttons & 1) === 0) {
          setResizeEdge(null);
          return;
        }
        e.preventDefault();
        const gutter = 8;
        const next = resolveCenteredWindowResize({
          start: {
            left: start.left,
            top: start.top,
            width: start.right - start.left,
            height: start.bottom - start.top,
          },
          edge: resizeEdge,
          deltaX: e.clientX - start.x,
          deltaY: e.clientY - start.y,
          minWidth,
          minHeight,
          bounds: { left: gutter, top: gutter, right: window.innerWidth - gutter, bottom: window.innerHeight - gutter },
        });
        const centerX = next.left + next.width / 2;
        const centerY = next.top + next.height / 2;
        setSize({ width: next.width, height: next.height });
        setPosition({
          x: centerX - window.innerWidth / 2,
          y: centerY - window.innerHeight / 2,
        });
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (e.pointerId !== resizeStartRef.current.pointerId) return;
        setResizeEdge(null);
      };

      const handleWindowBlur = () => {
        setResizeEdge(null);
      };

      document.addEventListener('pointermove', handlePointerMove, { passive: false });
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
      window.addEventListener('blur', handleWindowBlur);
      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.removeEventListener('pointercancel', handlePointerUp);
        window.removeEventListener('blur', handleWindowBlur);
      };
    }, [resizeEdge, minHeight, minWidth]);

    // Reset position when dialog opens
    const handleOpenAutoFocus = React.useCallback(
      (e: Event) => {
        setPosition({ x: 0, y: 0 });
        setSize(null);
        if (inline) e.preventDefault();
        props.onOpenAutoFocus?.(e);
      },
      [inline, props]
    );

    const content = (
      <DialogPrimitive.Content
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          onOpenAutoFocus={handleOpenAutoFocus}
          data-shared-dialog-contract="generic-editor"
          data-shared-window-contract={SHARED_DIALOG_WINDOW_CONTRACT}
          data-shared-window-factory-default={SHARED_WINDOW_FACTORY_DEFAULT.id}
          data-shared-window-kind="editor"
          data-shared-window-region="frame"
          data-shared-window-content="implicit"
          data-shared-window-theme-projection="active-page"
          data-shared-window-title-action-contract={SHARED_WINDOW_TITLE_ACTION_RAIL_CONTRACT}
          data-shared-window-small-card-marker-policy={SHARED_SMALL_CARD_MARKER_POLICY}
          data-shared-window-small-card-marker-contract={SHARED_SMALL_CARD_MARKER_CONTRACT_VERSION}
          data-shared-window-small-card-marker-scope-attribute={SHARED_SMALL_CARD_EFFECTIVE_SCOPE_ATTRIBUTE}
          data-shared-window-small-card-marker-resolution={SHARED_SMALL_CARD_MARKER_RESOLUTION}
          data-shared-window-small-card-marker-runtime-attribute={SHARED_SMALL_CARD_EFFECTIVE_MARKER_ATTRIBUTE}
          data-shared-window-small-card-surface-runtime-attribute={SHARED_SMALL_CARD_EFFECTIVE_SURFACE_ATTRIBUTE}
          className={cn(
            edgeToEdge
              ? 'fixed inset-0 z-50 grid w-screen max-w-none gap-4 rounded-none border bg-background p-0 shadow-lg'
              : 'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg',
            isDragging || resizeEdge ? 'select-none' : '',
            className
          )}
          style={{
            "--tradepro-shared-dialog-title-action-inset": "0px",
            ...(style || {}),
            ...expertPopupScale,
            ...(size ? ({
              "--tradepro-shared-runtime-window-width": `${size.width}px`,
              "--tradepro-shared-runtime-window-height": `${size.height}px`,
            } as React.CSSProperties) : {}),
            transform: edgeToEdge
              ? "translate(0, 0)"
              : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
            width: edgeToEdge ? "100vw" : size ? `${size.width}px` : style?.width,
            height: edgeToEdge ? "100dvh" : size ? `${size.height}px` : style?.height,
          }}
          onMouseDown={handleMouseDown}
          data-resizable-window={resizable ? "true" : undefined}
          data-shared-resizable-dialog={resizable ? "true" : undefined}
          data-shared-resizable-window-contract={resizable ? "true" : undefined}
          data-shared-resize-behavior={resizable ? SHARED_CENTER_SYMMETRIC_RESIZE_CONTRACT : undefined}
          data-dialog-dragging={isDragging ? "true" : undefined}
          data-dialog-resizing={resizeEdge || undefined}
          role={inline ? "region" : "dialog"}
          {...props}
        >
          {children}
          {resizable && !edgeToEdge ? (
            <>
              {DIALOG_RESIZE_EDGES.filter((edge) => edge !== "south-east").map((edge) => (
                <button
                  key={edge}
                  type="button"
                  aria-label={`Resize window from ${edge}`}
                  data-resize-handle
                  data-window-resize-edge={edge}
                  onPointerDown={handleResizePointerDown(edge)}
                  className="dialog-window-resize-edge"
                  tabIndex={-1}
                />
              ))}
            <button
              type="button"
              aria-label="调整窗口大小"
              data-resize-handle
              data-shared-resize-handle="true"
              data-shared-window-region="resize"
              onPointerDown={handleResizePointerDown("south-east")}
              className="dialog-resize-handle absolute bottom-0 right-0 z-40 flex h-9 w-9 cursor-se-resize items-center justify-center rounded-tl-md border-l border-t border-white/20 bg-slate-950/65 text-slate-100 transition hover:bg-slate-950 hover:text-white"
              title="按住拖拉调整窗口大小"
            >
              <Maximize2 className="pointer-events-none h-3.5 w-3.5" />
            </button>
            </>
          ) : null}
          {showCloseButton ? <SharedDialogCloseButton /> : null}
      </DialogPrimitive.Content>
    );

    return inline ? content : <DialogPortal><DialogOverlay />{content}</DialogPortal>;
  }
);
DraggableDialogContent.displayName = 'DraggableDialogContent';

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-shared-window-region="title"
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-dialog-responsive-actions="true"
    data-shared-window-region="footer"
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

/**
 * Optional explicit content region. Use it for settings and tool dialogs
 * whose body scrolls independently from the title and footer.
 */
const SharedDialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-shared-window-region="content"
    className={cn('min-h-0', className)}
    {...props}
  />
));
SharedDialogBody.displayName = 'SharedDialogBody';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-shared-title-heading
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-shared-title-description
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DraggableDialogContent,
  DialogHeader,
  DialogFooter,
  SharedDialogBody,
  DialogTitle,
  DialogDescription,
};
