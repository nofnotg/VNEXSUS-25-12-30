# Investigator View - User Guide

## 🎯 Overview

The Investigator View is a specialized interface for medical claim investigators to review, analyze, and document their findings on insurance claims. It provides a timeline-based visualization of medical events, episode management, and an integrated report editor.

## 🚀 Getting Started

### Accessing the Investigator View

1. **Upload Medical Documents**
   - Navigate to: `http://localhost:3030/hybrid-interface.html`
   - Upload PDF medical records
   - Wait for OCR processing to complete
   - Note the `jobId` from the results

2. **Open Investigator View**
   - Navigate to: `http://localhost:3030/investigator-view.html?jobId=<your-job-id>`
   - Replace `<your-job-id>` with the actual job ID from step 1

## 📊 Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🕵️ Investigator View                    [Export] [Settings] │
├───────────┬─────────────────────────────┬───────────────────┤
│           │                             │                   │
│ Episodes  │   Timeline                  │  Claim Summary    │
│           │                             │                   │
│ ● Ep 1    │  ○ Event 1 (2024-01-15)    │  Patient: John    │
│   Ep 2    │  ○ Event 2 (2024-02-20)    │  Claim: #12345    │
│   Ep 3    │  ○ Event 3 (2024-03-10)    │                   │
│           │                             │  Dispute Score    │
│           │  ─────────────────────────  │  ████████░░ 85%   │
│           │                             │                   │
│           │  Investigation Report       │  Phase: Review    │
│           │  ┌─────────────────────┐   │  Role: Primary    │
│           │  │ [Report Editor]     │   │                   │
│           │  │                     │   │  [Generate Report]│
│           │  │ Type your findings  │   │  [Flag for Review]│
│           │  │ here...             │   │                   │
│           │  └─────────────────────┘   │                   │
│           │  Saved: 12:34:56 PM [Save] │                   │
└───────────┴─────────────────────────────┴───────────────────┘
```

## 🔍 Features

### 1. Episode List (Left Sidebar)

**Purpose**: View and select medical episodes for detailed analysis

**Features**:
- Episode date ranges
- Primary diagnosis
- Hospital information
- Dispute tags (if applicable)

**Usage**:
- Click on an episode to filter the timeline
- Episodes with disputes are highlighted
- Selected episode is shown with a blue background

### 2. Timeline Panel (Center)

**Purpose**: Chronological visualization of medical events

**Features**:
- Event date and type
- Event summary and details
- Hospital information
- Automatic filtering based on selected episode

**Usage**:
- Scroll through events chronologically
- Events are sorted by date (oldest first)
- Click on events for more details (future feature)

### 3. Claim Summary Panel (Right)

**Purpose**: Quick reference for claim information and dispute analysis

**Features**:
- Patient information
- Claim and policy numbers
- Contract date
- Dispute importance score (0-100)
- Dispute phase and role

**Usage**:
- Review key claim details at a glance
- Monitor dispute importance score
- Use action buttons for workflow management

### 4. Report Editor (Bottom of Timeline)

**Purpose**: Document investigation findings and conclusions

**Features**:
- ✍️ Rich text editing area
- 💾 Manual save button
- ⏰ Auto-save every 30 seconds
- 📅 Last saved timestamp
- 🔄 Real-time save status

**Usage**:

1. **Writing a Report**
   ```
   - Click in the text area to start typing
   - The "Save" button will become enabled when you make changes
   - Continue writing your investigation findings
   ```

2. **Saving Your Work**
   ```
   Manual Save:
   - Click the "Save" button when ready
   - Wait for "Saved: <time>" confirmation
   
   Auto-Save:
   - System automatically saves every 30 seconds
   - No action required
   - Status shows "Saving..." during save operation
   ```

3. **Verifying Saved Content**
   ```
   - Refresh the page
   - Your report content should persist
   - Check the "Saved: <time>" timestamp
   ```

## 💡 Best Practices

### Investigation Workflow

1. **Initial Review**
   - Review all episodes in the left sidebar
   - Note any episodes with dispute tags
   - Check the dispute importance score

2. **Timeline Analysis**
   - Select each episode one by one
   - Review the filtered timeline events
   - Look for patterns or inconsistencies

3. **Documentation**
   - Start writing your findings in the report editor
   - Include specific dates and events
   - Note any red flags or concerns
   - Document your conclusions

4. **Regular Saving**
   - Save your work frequently
   - Don't rely solely on auto-save
   - Verify the "Saved" timestamp

### Report Writing Tips

**Structure Your Report**:
```
1. Executive Summary
   - Brief overview of the claim
   - Key findings
   - Recommendation

2. Timeline Analysis
   - Chronological review of events
   - Notable patterns or gaps

3. Episode-by-Episode Review
   - Detailed analysis of each episode
   - Supporting evidence

4. Conclusion
   - Final assessment
   - Recommended actions
```

**Use Clear Language**:
- Be specific with dates and events
- Reference episode IDs or dates
- Avoid ambiguous terms
- Document sources

## ⚠️ Important Notes

### Data Persistence

**Current Limitation**: 
- Reports are stored in server memory
- **Data will be lost if the server restarts**
- Always export or copy important reports before server maintenance

**Workaround**:
- Regularly copy your report to a local document
- Use the "Export Report" button (when implemented)
- Keep backups of critical findings

### Browser Compatibility

**Recommended Browsers**:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ⚠️ Safari (may have issues with auto-save)
- ❌ Internet Explorer (not supported)

### Performance Tips

- Avoid extremely long reports (>10,000 words)
- Clear browser cache if experiencing slowness
- Use a stable internet connection for auto-save

## 🐛 Troubleshooting

### Problem: "No data available" error

**Solution**:
1. Verify the jobId in the URL is correct
2. Ensure the OCR processing has completed
3. Check that the job exists by visiting `/api/ocr/status/<jobId>`

### Problem: Report not saving

**Solution**:
1. Check browser console for errors (F12)
2. Verify network connectivity
3. Ensure the server is running
4. Try manual save instead of relying on auto-save

### Problem: Page loads slowly

**Solution**:
1. Check if the job has many events (>100)
2. Clear browser cache
3. Refresh the page
4. Contact administrator if issue persists

### Problem: Auto-save not working

**Solution**:
1. Make sure you've made changes to the report
2. Wait the full 30 seconds
3. Check the save status message
4. Use manual save as backup

## 📞 Support

For technical issues or questions:
1. Check this guide first
2. Review the browser console for errors
3. Contact your system administrator
4. Provide the jobId and error message

## 🔮 Upcoming Features

- [ ] Episode filtering and selection
- [ ] Export to PDF
- [ ] Report templates
- [ ] Collaborative editing
- [ ] Version history
- [ ] Advanced search and filtering
- [ ] Integration with case management system
