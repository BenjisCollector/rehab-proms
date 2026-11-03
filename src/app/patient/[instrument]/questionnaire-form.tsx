"use client";

import { useActionState, useEffect, useRef } from "react";
import { type FormState, submitQuestionnaire } from "../actions";

export interface FormItem {
  linkId: string;
  text: string;
  required: boolean;
  options: { code: string; display: string }[];
}

const fieldId = (linkId: string) => `q${linkId.replace(/[^A-Za-z0-9]/g, "-")}`;

export function QuestionnaireForm({ instrumentId, stem, items }: { instrumentId: string; stem: string; items: FormItem[] }) {
  const [state, action, pending] = useActionState(submitQuestionnaire.bind(null, instrumentId), {} as FormState);
  const summaryRef = useRef<HTMLDivElement>(null);
  const errors = state.errors ?? {};
  const errorIds = Object.keys(errors);

  // Move focus to the error summary so screen reader and keyboard users know what went wrong.
  useEffect(() => {
    if (errorIds.length) summaryRef.current?.focus();
  }, [state, errorIds.length]);

  return (
    <form action={action} noValidate>
      {errorIds.length > 0 && (
        <div className="error-summary" ref={summaryRef} tabIndex={-1} aria-labelledby="error-summary-title">
          <h2 id="error-summary-title">There is a problem</h2>
          <ul>
            {errorIds.map((linkId) => (
              <li key={linkId}>
                <a href={`#${fieldId(linkId)}-0`}>{errors[linkId]}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="lead">{stem}</p>
      {items.map((item, n) => {
        const id = fieldId(item.linkId);
        const error = errors[item.linkId];
        return (
          <fieldset key={item.linkId} className={`question${error ? " has-error" : ""}`} aria-describedby={error ? `${id}-error` : undefined}>
            <legend>
              <span className="q-number">
                Question {n + 1} of {items.length}
                {!item.required && " (optional)"}
              </span>
              <span className="q-text">{item.text}</span>
            </legend>
            {error && (
              <p id={`${id}-error`} className="error-message">
                <span className="visually-hidden">Error:</span> {error}
              </p>
            )}
            <div className="options">
              {item.options.map((o, i) => (
                <div className="option" key={o.code}>
                  <input
                    type="radio"
                    id={`${id}-${i}`}
                    name={item.linkId}
                    value={o.code}
                    defaultChecked={state.values?.[item.linkId] === o.code}
                  />
                  <label htmlFor={`${id}-${i}`}>{o.display}</label>
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Sending..." : "Send my answers"}
      </button>
    </form>
  );
}
