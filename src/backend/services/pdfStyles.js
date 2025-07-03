// PDF Styling Constants and Configuration
export const PDF_STYLES = {
  // Enhanced Professional Color Palette
  colors: {
    primary: '#1e40af',      // Professional blue
    primaryLight: '#3b82f6', // Lighter blue
    primaryDark: '#1e3a8a',  // Darker blue
    secondary: '#64748b',    // Slate gray
    secondaryLight: '#94a3b8', // Light slate
    accent: '#059669',       // Success green
    accentLight: '#10b981',  // Light green
    text: '#1f2937',         // Dark gray
    textLight: '#6b7280',    // Light gray
    textMuted: '#9ca3af',    // Muted gray
    background: '#f8fafc',   // Very light gray
    backgroundDark: '#f1f5f9', // Darker background
    border: '#e5e7eb',       // Border gray
    borderLight: '#f3f4f6',  // Light border
    white: '#ffffff',
    error: '#dc2626',        // Red for overdue
    errorLight: '#f87171',   // Light red
    warning: '#d97706',      // Orange for warnings
    warningLight: '#fbbf24', // Light orange
    info: '#0ea5e9',         // Info blue
    infoLight: '#38bdf8',     // Light info
    // Utility-specific colors
    electricity: '#eab308',  // Yellow for electricity
    water: '#0ea5e9',        // Blue for water
    heating: '#dc2626',      // Red for heating
    internet: '#7c3aed',     // Purple for internet
    maintenance: '#059669'   // Green for maintenance
  },

  // Typography - Using DejaVu Sans for perfect Slovenian character support
  fonts: {
    primary: 'DejaVuSans',
    secondary: 'DejaVuSans-Bold',
    mono: 'Courier'
  },

  // Enhanced Typography Hierarchy
  fontSize: {
    display: 28,      // For major headers
    title: 24,        // Main titles
    titleLarge: 20,   // Large titles
    heading: 18,      // Section headings
    subheading: 14,   // Sub-section headings
    body: 12,         // Body text
    bodyLarge: 13,    // Larger body text
    small: 10,        // Small text
    tiny: 8,          // Very small text
    micro: 7          // Micro text
  },

  // Spacing
  spacing: {
    pageMargin: 50,
    section: 20,
    line: 15,
    small: 8,
    tiny: 4
  },

  // Layout
  layout: {
    pageWidth: 595.28,      // A4 width in points
    pageHeight: 841.89,     // A4 height in points
    contentWidth: 495.28,   // Page width minus margins
    headerHeight: 120,      // Increased for professional header
    footerHeight: 60,       // Increased for enhanced footer
    cardPadding: 12,
    cardMargin: 8
  },

  // Enhanced Line Styles
  lines: {
    hairline: 0.25,
    thin: 0.5,
    normal: 1,
    medium: 1.5,
    thick: 2,
    heavy: 3
  },

  // Shadow and Effects
  effects: {
    shadowOffset: 2,
    shadowBlur: 4,
    shadowColor: '#00000020',
    borderRadius: {
      small: 2,
      medium: 4,
      large: 8,
      xl: 12
    }
  }
};

export const PDF_UTILS = {
  // Convert hex color to RGB array
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  },

  // Draw a styled section separator
  drawSectionSeparator(doc, y, width = PDF_STYLES.layout.contentWidth) {
    doc.strokeColor(PDF_STYLES.colors.border)
       .lineWidth(PDF_STYLES.lines.thin)
       .moveTo(PDF_STYLES.spacing.pageMargin, y)
       .lineTo(PDF_STYLES.spacing.pageMargin + width, y)
       .stroke();
  },

  // Draw a styled box/card
  drawCard(doc, x, y, width, height, options = {}) {
    const {
      fillColor = PDF_STYLES.colors.white,
      borderColor = PDF_STYLES.colors.border,
      borderWidth = PDF_STYLES.lines.thin,
      cornerRadius = 4
    } = options;
    
    const fillRgb = this.hexToRgb(fillColor);
    const borderRgb = this.hexToRgb(borderColor);
    
    doc.roundedRect(x, y, width, height, cornerRadius)
       .fillAndStroke(fillRgb, borderRgb)
       .lineWidth(borderWidth);
  },

  // Draw a professional info box with icon space
  drawInfoCard(doc, x, y, width, title, content, options = {}) {
    const {
      titleColor = PDF_STYLES.colors.primary,
      contentColor = PDF_STYLES.colors.text,
      backgroundColor = PDF_STYLES.colors.background
    } = options;
    
    const cardHeight = 60;
    const padding = PDF_STYLES.layout.cardPadding;
    
    // Draw card background
    this.drawCard(doc, x, y, width, cardHeight, {
      fillColor: backgroundColor,
      borderColor: PDF_STYLES.colors.border
    });
    
    // Title
    this.addStyledText(doc, title, x + padding, y + padding, {
      fontSize: PDF_STYLES.fontSize.small,
      color: titleColor,
      font: PDF_STYLES.fonts.secondary
    });
    
    // Content
    this.addStyledText(doc, content, x + padding, y + padding + 16, {
      fontSize: PDF_STYLES.fontSize.body,
      color: contentColor
    });
    
    return y + cardHeight + PDF_STYLES.layout.cardMargin;
  },

  // Add styled text with optional background
  addStyledText(doc, text, x, y, options = {}) {
    const {
      fontSize = PDF_STYLES.fontSize.body,
      color = PDF_STYLES.colors.text,
      font = PDF_STYLES.fonts.primary,
      align = 'left',
      background = null,
      padding = 0
    } = options;

    // Set font and color
    doc.font(font)
       .fontSize(fontSize)
       .fillColor(color);

    // Add background if specified
    if (background) {
      const textWidth = doc.widthOfString(text);
      const textHeight = fontSize * 1.2;
      const bgRgb = this.hexToRgb(background);
      
      doc.rect(x - padding, y - padding, textWidth + (padding * 2), textHeight + (padding * 2))
         .fill(bgRgb);
      
      doc.fillColor(color);
    }

    // Add text
    doc.text(text, x, y, { align });
  },

  // Calculate next Y position with spacing
  getNextY(currentY, spacing = PDF_STYLES.spacing.line) {
    return currentY + spacing;
  },

  // Check if content fits on current page
  fitsOnPage(currentY, contentHeight, marginBottom = 100) {
    return (currentY + contentHeight + marginBottom) <= (PDF_STYLES.layout.pageHeight - PDF_STYLES.spacing.pageMargin);
  },

  // Draw a progress bar/timeline for visualizing periods
  drawTimeline(doc, x, y, width, progress, options = {}) {
    const {
      height = 12,
      backgroundColor = PDF_STYLES.colors.background,
      progressColor = PDF_STYLES.colors.accent,
      borderColor = PDF_STYLES.colors.border,
      showPercentage = true
    } = options;

    // Background bar
    const bgRgb = this.hexToRgb(backgroundColor);
    const borderRgb = this.hexToRgb(borderColor);
    doc.rect(x, y, width, height)
       .fillAndStroke(bgRgb, borderRgb);

    // Progress bar
    if (progress > 0) {
      const progressWidth = (width * progress) / 100;
      const progressRgb = this.hexToRgb(progressColor);
      doc.rect(x + 1, y + 1, progressWidth - 2, height - 2)
         .fill(progressRgb);
    }

    // Percentage text
    if (showPercentage) {
      const centerX = x + width / 2;
      const centerY = y + height / 2 - 4;
      this.addStyledText(doc, `${progress}%`, centerX - 10, centerY, {
        fontSize: PDF_STYLES.fontSize.tiny,
        color: progress > 50 ? PDF_STYLES.colors.white : PDF_STYLES.colors.text
      });
    }

    return y + height + PDF_STYLES.spacing.small;
  },

  // Draw a professional table with headers and alternating row colors
  drawTable(doc, x, y, columns, data, options = {}) {
    const {
      headerHeight = 25,
      rowHeight = 20,
      headerColor = PDF_STYLES.colors.primary,
      headerTextColor = PDF_STYLES.colors.white,
      evenRowColor = PDF_STYLES.colors.white,
      oddRowColor = PDF_STYLES.colors.background,
      borderColor = PDF_STYLES.colors.border,
      fontSize = PDF_STYLES.fontSize.small
    } = options;

    let currentY = y;
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

    // Draw table border
    const borderRgb = this.hexToRgb(borderColor);
    doc.rect(x, y, tableWidth, headerHeight + (data.length * rowHeight))
       .stroke(borderRgb);

    // Draw header
    const headerRgb = this.hexToRgb(headerColor);
    doc.rect(x, currentY, tableWidth, headerHeight)
       .fill(headerRgb);

    let currentX = x;
    columns.forEach(column => {
      // Header text with alignment support
      const headerAlign = column.headerAlign || 'left';
      let headerTextX = currentX + 5;
      
      if (headerAlign === 'right') {
        headerTextX = currentX + column.width - 5 - doc.widthOfString(column.header);
      } else if (headerAlign === 'center') {
        headerTextX = currentX + (column.width - doc.widthOfString(column.header)) / 2;
      }
      
      this.addStyledText(doc, column.header, headerTextX, currentY + 6, {
        fontSize: fontSize,
        color: headerTextColor,
        font: PDF_STYLES.fonts.secondary
      });

      // Vertical separator
      doc.moveTo(currentX + column.width, currentY)
         .lineTo(currentX + column.width, currentY + headerHeight + (data.length * rowHeight))
         .stroke(borderRgb);

      currentX += column.width;
    });

    currentY += headerHeight;

    // Draw data rows
    data.forEach((row, index) => {
      // Alternating row colors
      const rowColor = index % 2 === 0 ? evenRowColor : oddRowColor;
      const rowRgb = this.hexToRgb(rowColor);
      doc.rect(x, currentY, tableWidth, rowHeight)
         .fill(rowRgb);

      // Row data
      currentX = x;
      columns.forEach(column => {
        const cellValue = row[column.key] || '';
        const textColor = column.color || PDF_STYLES.colors.text;
        const textAlign = column.align || 'left';
        
        let textX = currentX + 5;
        if (textAlign === 'right') {
          textX = currentX + column.width - 5 - doc.widthOfString(cellValue);
        } else if (textAlign === 'center') {
          textX = currentX + (column.width - doc.widthOfString(cellValue)) / 2;
        }

        this.addStyledText(doc, cellValue, textX, currentY + 4, {
          fontSize: fontSize,
          color: textColor,
          font: column.bold ? PDF_STYLES.fonts.secondary : PDF_STYLES.fonts.primary
        });

        currentX += column.width;
      });

      // Horizontal separator
      doc.moveTo(x, currentY + rowHeight)
         .lineTo(x + tableWidth, currentY + rowHeight)
         .stroke(borderRgb);

      currentY += rowHeight;
    });

    return currentY + PDF_STYLES.spacing.section;
  },

  // Draw a card with shadow effect
  drawCardWithShadow(doc, x, y, width, height, options = {}) {
    const {
      fillColor = PDF_STYLES.colors.white,
      borderColor = PDF_STYLES.colors.border,
      borderRadius = PDF_STYLES.effects.borderRadius.medium,
      shadowOffset = PDF_STYLES.effects.shadowOffset,
      shadowColor = PDF_STYLES.effects.shadowColor
    } = options;

    // Draw shadow
    const shadowRgb = this.hexToRgb(shadowColor);
    doc.roundedRect(x + shadowOffset, y + shadowOffset, width, height, borderRadius)
       .fill(shadowRgb);

    // Draw main card
    const fillRgb = this.hexToRgb(fillColor);
    const borderRgb = this.hexToRgb(borderColor);
    doc.roundedRect(x, y, width, height, borderRadius)
       .fillAndStroke(fillRgb, borderRgb);
  },

  // Get utility type icon and color
  getUtilityStyle(utilityType) {
    const type = utilityType.toLowerCase();
    
    if (type.includes('elektrika') || type.includes('electricity')) {
      return { icon: '', color: PDF_STYLES.colors.electricity, name: 'Electricity' };
    } else if (type.includes('voda') || type.includes('water')) {
      return { icon: '', color: PDF_STYLES.colors.water, name: 'Water' };
    } else if (type.includes('ogrevanje') || type.includes('heating') || type.includes('plin')) {
      return { icon: '', color: PDF_STYLES.colors.heating, name: 'Heating' };
    } else if (type.includes('internet') || type.includes('wifi') || type.includes('net')) {
      return { icon: '', color: PDF_STYLES.colors.internet, name: 'Internet' };
    } else if (type.includes('vzdrževanje') || type.includes('maintenance')) {
      return { icon: '', color: PDF_STYLES.colors.maintenance, name: 'Maintenance' };
    } else {
      return { icon: '', color: PDF_STYLES.colors.secondary, name: 'Other' };
    }
  },

  // Draw enhanced section header with visual elements
  drawSectionHeader(doc, x, y, title, options = {}) {
    const {
      width = PDF_STYLES.layout.contentWidth,
      color = PDF_STYLES.colors.primary,
      backgroundColor = PDF_STYLES.colors.backgroundDark,
      fontSize = PDF_STYLES.fontSize.heading,
      icon = null
    } = options;

    const headerHeight = 35;
    
    // Header background with gradient effect
    const bgRgb = this.hexToRgb(backgroundColor);
    const borderRgb = this.hexToRgb(color);
    
    doc.roundedRect(x, y, width, headerHeight, PDF_STYLES.effects.borderRadius.small)
       .fillAndStroke(bgRgb, borderRgb)
       .lineWidth(PDF_STYLES.lines.medium);

    // Left accent bar
    const accentRgb = this.hexToRgb(color);
    doc.rect(x, y, 4, headerHeight)
       .fill(accentRgb);

    // Header text with icon
    const textX = x + (icon ? 35 : 15);
    
    if (icon) {
      this.addStyledText(doc, icon, x + 12, y + 8, {
        fontSize: fontSize,
        color: color
      });
    }
    
    this.addStyledText(doc, title, textX, y + 8, {
      fontSize: fontSize,
      color: color,
      font: PDF_STYLES.fonts.secondary
    });

    return y + headerHeight + PDF_STYLES.spacing.section;
  },

  // Draw status indicator with color coding
  drawStatusIndicator(doc, x, y, status, options = {}) {
    const { size = 8 } = options;
    
    let color;
    switch (status.toLowerCase()) {
      case 'active':
      case 'full':
      case 'paid':
        color = PDF_STYLES.colors.accent;
        break;
      case 'partial':
      case 'prorated':
      case 'pending':
        color = PDF_STYLES.colors.warning;
        break;
      case 'overdue':
      case 'error':
        color = PDF_STYLES.colors.error;
        break;
      default:
        color = PDF_STYLES.colors.textMuted;
    }
    
    const statusRgb = this.hexToRgb(color);
    doc.circle(x, y, size)
       .fill(statusRgb);
       
    return x + size * 2 + 5;
  },

  // Generate optimized filename
  generateFileName(tenant, month, year, type = 'statement') {
    const cleanName = tenant.name.replace(/\s+/g, '_');
    const cleanSurname = tenant.surname.replace(/\s+/g, '_');
    const monthPadded = month.toString().padStart(2, '0');
    const timestamp = new Date().toISOString().slice(0, 10);
    
    return `${type}_${cleanName}_${cleanSurname}_${year}${monthPadded}_${timestamp}.pdf`;
  }
};