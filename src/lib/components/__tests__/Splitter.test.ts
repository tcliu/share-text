// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import Splitter from '../Splitter.svelte'

function setup(props: Record<string, unknown> = {}) {
  const onChange = vi.fn()
  const onDragEnd = vi.fn()
  render(Splitter, {
    value: 288,
    min: 160,
    max: 480,
    onChange,
    onDragEnd,
    ...props,
  })
  return { onChange, onDragEnd }
}

function getHandle() {
  return screen.getByRole('separator')
}

describe('Splitter', () => {
  it('renders a separator with aria values', () => {
    setup()
    const handle = getHandle()
    expect(handle).toBeTruthy()
    expect(handle.getAttribute('aria-valuenow')).toBe('288')
    expect(handle.getAttribute('aria-valuemin')).toBe('160')
    expect(handle.getAttribute('aria-valuemax')).toBe('480')
  })

  it('reports drag deltas via pointer events', async () => {
    const { onChange, onDragEnd } = setup()
    const handle = getHandle()
    handle.setPointerCapture = vi.fn()
    handle.hasPointerCapture = vi.fn(() => true)
    handle.releasePointerCapture = vi.fn()

    await fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 })
    await fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(328)
    await fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(onDragEnd).toHaveBeenCalledTimes(1)
  })

  it('clamps the width during a drag', async () => {
    const { onChange } = setup()
    const handle = getHandle()
    handle.setPointerCapture = vi.fn()

    await fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 })
    await fireEvent.pointerMove(handle, { clientX: 1000, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(480)
  })

  it('adjusts the width with arrow keys', async () => {
    const onChange = vi.fn()
    const onDragEnd = vi.fn()
    const { rerender } = render(Splitter, {
      value: 288,
      min: 160,
      max: 480,
      onChange,
      onDragEnd,
    })
    const handle = getHandle()
    await fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(304)
    await rerender({ value: 304, min: 160, max: 480, onChange, onDragEnd })
    await fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(288)
  })

  it('converts drag deltas to percentages in % mode', async () => {
    const { onChange, onDragEnd } = setup({ value: 50, min: 10, max: 90, unit: '%' })
    const handle = getHandle()
    handle.setPointerCapture = vi.fn()
    handle.hasPointerCapture = vi.fn(() => true)
    handle.releasePointerCapture = vi.fn()
    Object.defineProperty(handle, 'parentElement', { value: { clientWidth: 500 } })

    await fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 })
    await fireEvent.pointerMove(handle, { clientX: 125, pointerId: 1 })
    expect(onChange).toHaveBeenLastCalledWith(55)
    await fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(onDragEnd).toHaveBeenCalledTimes(1)
  })

  it('clamps percentage values and steps by 1 with arrow keys in % mode', async () => {
    const onChange = vi.fn()
    const onDragEnd = vi.fn()
    const { rerender } = render(Splitter, {
      value: 50,
      min: 10,
      max: 90,
      unit: '%',
      onChange,
      onDragEnd,
    })
    const handle = getHandle()
    await fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(51)
    await rerender({ value: 51, min: 10, max: 90, unit: '%', onChange, onDragEnd })
    await fireEvent.keyDown(handle, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(10)
  })

  it('jumps to min and max with Home and End keys', async () => {
    const { onChange } = setup()
    const handle = getHandle()
    await fireEvent.keyDown(handle, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(160)
    await fireEvent.keyDown(handle, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(480)
  })
})
