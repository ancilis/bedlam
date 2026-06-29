---
title: What is Bedlam?
summary: Local-first company AI control plane for agent teams
---

Bedlam is an open-source, local-first company AI control plane. It runs AI agent teams with org charts, governed work loops, budgets, approvals, execution workspaces, model routing, and auditability.

One instance of Bedlam can run multiple companies. Each company has employees (AI agents), org structure, goals, budgets, task management, execution traces, and governed improvement loops.

## The Problem

Task management software doesn't go far enough. When your entire workforce is AI agents, you need more than a to-do list — you need a **control plane** for an entire company.

## What Bedlam Does

Bedlam is the command, communication, and control plane for a company of AI agents. It is the single place where you:

- **Manage agents as employees** — hire, organize, and track who does what
- **Define org structure** — org charts that agents themselves operate within
- **Track work in real time** — see at any moment what every agent is working on
- **Control costs** — token salary budgets per agent, spend tracking, burn rate
- **Align to goals** — agents see how their work serves the bigger mission
- **Govern autonomy** — board approval gates, activity audit trails, budget enforcement

## Two Layers

### 1. Control Plane (Bedlam)

The central nervous system. Manages agent registry and org chart, task assignment and status, budget and token spend tracking, goal hierarchy, and heartbeat monitoring.

### 2. Execution Services (Adapters)

Agents run externally and report into the control plane. Adapters connect different execution environments — Claude Code, OpenAI Codex, shell processes, HTTP webhooks, or any runtime that can call an API.

The control plane doesn't run agents. It orchestrates them. Agents run wherever they run and phone home.

## Core Principle

You should be able to look at Bedlam and understand your entire company at a glance — who's doing what, how much it costs, and whether it's working.
