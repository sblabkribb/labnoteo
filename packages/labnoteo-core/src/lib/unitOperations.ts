/**
 * Unit Operations for Biofoundry Workflows
 * Hardware and Software operations used in laboratory automation
 * 
 * This file is used by the VS Code extension commands.
 * The webview has its own copy at webview/src/data/unitOperations.ts
 */

export interface UnitOperation {
  id: string;
  name: string;
  description: string;
  category: 'Hardware' | 'Software';
}

export const UNIT_OPERATIONS: UnitOperation[] = [
  // Hardware Operations
  {
    id: 'OPHW-001',
    name: 'Acoustic Liquid Handling',
    description: 'Accurate nL-µL liquid transfers using acoustic droplet ejection',
    category: 'Hardware',
  },
  {
    id: 'OPHW-002',
    name: 'Tip-Based Liquid Handling',
    description: 'Automated pipette-based liquid handling system',
    category: 'Hardware',
  },
  {
    id: 'OPHW-003',
    name: 'Colony Picking',
    description: 'Automated colony picking from agar plates',
    category: 'Hardware',
  },
  {
    id: 'OPHW-004',
    name: 'Microplate Reader',
    description: 'Absorbance, fluorescence, luminescence measurements',
    category: 'Hardware',
  },
  {
    id: 'OPHW-005',
    name: 'Thermocycler',
    description: 'PCR amplification and temperature-controlled reactions',
    category: 'Hardware',
  },
  {
    id: 'OPHW-006',
    name: 'Incubator Shaker',
    description: 'Temperature-controlled shaking incubation',
    category: 'Hardware',
  },
  {
    id: 'OPHW-007',
    name: 'Centrifugation',
    description: 'High-speed centrifugation for sample separation',
    category: 'Hardware',
  },
  {
    id: 'OPHW-008',
    name: 'Plate Sealer',
    description: 'Automated sealing of microplates',
    category: 'Hardware',
  },
  {
    id: 'OPHW-009',
    name: 'Plate Peeler',
    description: 'Automated peeling of microplate seals',
    category: 'Hardware',
  },
  {
    id: 'OPHW-010',
    name: 'Barcode Reader',
    description: 'Reading plate barcodes for sample tracking',
    category: 'Hardware',
  },
  {
    id: 'OPHW-011',
    name: 'UV Crosslinker',
    description: 'UV-based crosslinking for DNA fixation',
    category: 'Hardware',
  },
  {
    id: 'OPHW-012',
    name: 'Flow Cytometry',
    description: 'Cell sorting and analysis using flow cytometry',
    category: 'Hardware',
  },
  {
    id: 'OPHW-013',
    name: 'Gel Electrophoresis',
    description: 'DNA/RNA separation by gel electrophoresis',
    category: 'Hardware',
  },
  {
    id: 'OPHW-014',
    name: 'Gel Imaging',
    description: 'Imaging of gels for documentation and analysis',
    category: 'Hardware',
  },
  {
    id: 'OPHW-015',
    name: 'Mass Spectrometry',
    description: 'LC-MS or GC-MS for metabolite and protein analysis',
    category: 'Hardware',
  },
  {
    id: 'OPHW-016',
    name: 'NGS Sequencing',
    description: 'Next-generation sequencing library preparation and run',
    category: 'Hardware',
  },
  {
    id: 'OPHW-017',
    name: 'Electroporator',
    description: 'Electroporation for cell transformation',
    category: 'Hardware',
  },
  {
    id: 'OPHW-018',
    name: 'Magnetic Bead Handler',
    description: 'Automated magnetic bead-based separation',
    category: 'Hardware',
  },
  {
    id: 'OPHW-019',
    name: 'Bioreactor',
    description: 'Controlled fermentation and cell culture',
    category: 'Hardware',
  },
  {
    id: 'OPHW-020',
    name: 'Storage System',
    description: 'Automated sample storage at -20°C or -80°C',
    category: 'Hardware',
  },

  // Software Operations
  {
    id: 'OPSW-001',
    name: 'Sequence Alignment',
    description: 'Align sequences against reference genomes',
    category: 'Software',
  },
  {
    id: 'OPSW-002',
    name: 'Variant Calling',
    description: 'Identify SNPs and indels from aligned reads',
    category: 'Software',
  },
  {
    id: 'OPSW-003',
    name: 'Read Quality Control',
    description: 'Quality filtering and trimming of sequencing reads',
    category: 'Software',
  },
  {
    id: 'OPSW-004',
    name: 'Differential Expression',
    description: 'Analyze differential gene expression from RNA-seq',
    category: 'Software',
  },
  {
    id: 'OPSW-005',
    name: 'Pathway Analysis',
    description: 'Metabolic pathway enrichment and analysis',
    category: 'Software',
  },
  {
    id: 'OPSW-006',
    name: 'Protein Structure Prediction',
    description: 'Predict 3D protein structures using AI models',
    category: 'Software',
  },
  {
    id: 'OPSW-007',
    name: 'Primer Design',
    description: 'Design PCR primers for target amplification',
    category: 'Software',
  },
  {
    id: 'OPSW-008',
    name: 'gRNA Design',
    description: 'Design CRISPR guide RNAs for genome editing',
    category: 'Software',
  },
  {
    id: 'OPSW-009',
    name: 'Data Visualization',
    description: 'Generate plots and visualizations for analysis results',
    category: 'Software',
  },
  {
    id: 'OPSW-010',
    name: 'Statistical Analysis',
    description: 'Statistical testing and data analysis',
    category: 'Software',
  },
  {
    id: 'OPSW-011',
    name: 'Machine Learning Model',
    description: 'Train and apply ML models for prediction',
    category: 'Software',
  },
  {
    id: 'OPSW-012',
    name: 'Codon Optimization',
    description: 'Optimize codon usage for expression hosts',
    category: 'Software',
  },
  {
    id: 'OPSW-013',
    name: 'Plasmid Design',
    description: 'Design and annotate plasmid constructs',
    category: 'Software',
  },
  {
    id: 'OPSW-014',
    name: 'Metabolomics Analysis',
    description: 'Process and analyze metabolomics data',
    category: 'Software',
  },
  {
    id: 'OPSW-015',
    name: 'LIMS Integration',
    description: 'Data exchange with laboratory information management system',
    category: 'Software',
  },
];

/**
 * Get unit operations by category
 */
export function getOperationsByCategory(category: UnitOperation['category']): UnitOperation[] {
  return UNIT_OPERATIONS.filter(op => op.category === category);
}
