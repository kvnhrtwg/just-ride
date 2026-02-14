import { X } from 'lucide-react'
import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  forwardRef,
} from 'react'
import './Popover.scss'

type PopoverTitleTag = 'h2' | 'h3'

type PopoverProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'id' | 'children' | 'popover' | 'role' | 'aria-labelledby' | 'className'
> & {
  id: string
  title: string
  closeLabel: string
  children: ReactNode
  className?: string
  size?: 'default' | 'wide'
  titleTag?: PopoverTitleTag
}

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  {
    id,
    title,
    closeLabel,
    children,
    className,
    size = 'default',
    titleTag = 'h2',
    ...props
  },
  ref
) {
  const titleId = `${id}-title`
  const TitleTag = titleTag
  const popoverClassName = ['cp-popover', size === 'wide' ? 'cp-popover--wide' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      id={id}
      ref={ref}
      popover="auto"
      className={popoverClassName}
      role="dialog"
      aria-labelledby={titleId}
      {...props}
    >
      <div className="cp-popover-header">
        <TitleTag id={titleId} className="cp-popover-title">
          {title}
        </TitleTag>
        <button
          type="button"
          className="cp-btn cp-popover-close"
          popoverTarget={id}
          popoverTargetAction="hide"
          aria-label={closeLabel}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>
  )
})
