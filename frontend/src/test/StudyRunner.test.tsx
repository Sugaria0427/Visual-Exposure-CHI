import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ProtectionGatingRunner } from '../components/QuestionRunner';

describe('Protection Gating Logic (RQ2)', () => {
  const q1Config = {
    prompt: '你是否已有足够信息作出判断？',
    options: [
      { value: '1', label: '1. 信息充分' },
      { value: '2', label: '2. 信息暂定' },
      { value: '3', label: '3. 信息不足无法判断' },
    ],
  };

  const q2Config = {
    prompt: '你的保护担忧程度是？',
    options: [
      { value: '1', label: '1 - 无担忧' },
      { value: '3', label: '3 - 中等担忧' },
      { value: '5', label: '5 - 极强担忧' },
    ],
  };

  it('skips Q2 structurally when Q1 is selected as 3 (unable)', () => {
    const handleSubmit = vi.fn();
    render(
      <ProtectionGatingRunner
        q1Config={q1Config}
        q2Config={q2Config}
        phase="pre"
        onSubmit={handleSubmit}
      />
    );

    // Select Q1 option 3
    const opt3 = screen.getByText('3. 信息不足无法判断');
    fireEvent.click(opt3);

    // Q2 prompt should NOT be rendered
    expect(screen.queryByText('你的保护担忧程度是？')).toBeNull();

    // Click submit
    const submitBtn = screen.getByText('确认并进入下一环节');
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      q1: '3',
      q2: null,
      q2_asked: 0,
      skip_reason: 'q1_insufficient',
    });
  });

  it('renders Q2 and requires answer when Q1 is selected as 1 (sufficient)', () => {
    const handleSubmit = vi.fn();
    render(
      <ProtectionGatingRunner
        q1Config={q1Config}
        q2Config={q2Config}
        phase="pre"
        onSubmit={handleSubmit}
      />
    );

    // Select Q1 option 1
    const opt1 = screen.getByText('1. 信息充分');
    fireEvent.click(opt1);

    // Q2 prompt MUST be rendered
    expect(screen.getByText('你的保护担忧程度是？')).toBeDefined();

    // Select Q2 option 3
    const q2Opt = screen.getByText('3 - 中等担忧');
    fireEvent.click(q2Opt);

    // Click submit
    const submitBtn = screen.getByText('确认并进入下一环节');
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      q1: '1',
      q2: '3',
      q2_asked: 1,
      skip_reason: null,
    });
  });
});
