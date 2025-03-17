import { Router } from 'express';
import { z } from 'zod';
import { organizationSchema } from '@shared/schema';
import { db } from '../db';
import { organizations, users, employeeRequestSchema, verifyTransactionSchema } from '@shared/organizations';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const router = Router();

import { encrypt, decrypt, sanitizeInput, validateRoutingNumber, generateSecureToken } from '../utils/encryption';

// Create a new organization
router.post('/', async (req, res) => {
  try {
    const { name, country, registrationNumber, address, billingAccount, receivingAccount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Validate required fields
    if (!name || !country || !registrationNumber || !address || !billingAccount || !receivingAccount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Process billing account
    if (billingAccount.type === 'bank_account' && billingAccount.bankDetails) {
      const { accountNumber, routingNumber, bankName, accountHolderName } = billingAccount.bankDetails;
      
      // Validate routing number
      if (!validateRoutingNumber(routingNumber)) {
        return res.status(400).json({ message: 'Invalid routing number' });
      }

      // Sanitize inputs
      billingAccount.bankDetails.bankName = sanitizeInput(bankName);
      billingAccount.bankDetails.accountHolderName = sanitizeInput(accountHolderName);

      // Encrypt sensitive data
      billingAccount.bankDetails.accountNumber = encrypt(accountNumber);
      billingAccount.bankDetails.routingNumber = encrypt(routingNumber);
      if (billingAccount.bankDetails.swiftCode) {
        billingAccount.bankDetails.swiftCode = encrypt(billingAccount.bankDetails.swiftCode);
      }
      if (billingAccount.bankDetails.ibanNumber) {
        billingAccount.bankDetails.ibanNumber = encrypt(billingAccount.bankDetails.ibanNumber);
      }
    }

    // Process receiving account
    if (receivingAccount.type === 'bank_account' && receivingAccount.bankDetails) {
      const { accountNumber, sortCode, accountHolderName } = receivingAccount.bankDetails;
      
      // Sanitize inputs
      receivingAccount.bankDetails.accountHolderName = sanitizeInput(accountHolderName);

      // Encrypt sensitive data
      receivingAccount.bankDetails.accountNumber = encrypt(accountNumber);
      receivingAccount.bankDetails.sortCode = encrypt(sortCode);
    }

    const organization = {
      id: randomUUID(),
      name: sanitizeInput(name),
      country: sanitizeInput(country),
      registrationNumber: sanitizeInput(registrationNumber),
      address: sanitizeInput(address),
      billingAccount,
      receivingAccount,
      employees: [userId],
      employeeRequests: [],
      activityLog: [{
        timestamp: new Date().toISOString(),
        employeeId: userId,
        action: 'Organization created'
      }],
      createdAt: new Date().toISOString()
    };

    // Validate organization data
    const validationResult = organizationSchema.safeParse(organization);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Invalid organization data',
        errors: validationResult.error.errors 
      });
    }

    // Save organization to database
    const [createdOrg] = await db
      .insert(organizations)
      .values({
        id: organization.id,
        name: organization.name,
        country: organization.country,
        registrationNumber: organization.registrationNumber,
        address: organization.address,
        billingAccount: organization.billingAccount,
        receivingAccount: organization.receivingAccount,
        employees: organization.employees,
        employeeRequests: organization.employeeRequests,
        activityLog: organization.activityLog,
        createdAt: new Date(organization.createdAt)
      })
      .returning();

    // Update user's organization ID in database
    await db
      .update(users)
      .set({
        organizationId: createdOrg.id,
        isBusinessAccount: true
      })
      .where(eq(users.id, userId));

    res.status(201).json(createdOrg);
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ message: 'Failed to create organization' });
  }
});

// Get organization details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (!organization.employees.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(organization);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ message: 'Failed to get organization details' });
  }
});

// Handle employee requests
router.post('/:id/employees/request', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (organization.employees.includes(userId)) {
      return res.status(400).json({ message: 'Already a member' });
    }

    if (organization.employeeRequests.includes(userId)) {
      return res.status(400).json({ message: 'Request already pending' });
    }

    const updatedOrg = await db
      .update(organizations)
      .set({
        employeeRequests: [...organization.employeeRequests, userId],
        activityLog: [...organization.activityLog, {
          timestamp: new Date().toISOString(),
          employeeId: userId,
          action: 'Employee request submitted'
        }]
      })
      .where(eq(organizations.id, id))
      .returning();

    res.json({ message: 'Request submitted successfully' });
  } catch (error) {
    console.error('Employee request error:', error);
    res.status(500).json({ message: 'Failed to submit employee request' });
  }
});

// Handle employee request approval/rejection
router.post('/:id/employees/:employeeId', async (req, res) => {
  try {
    const { id, employeeId } = req.params;
    const { action } = req.body;
    const userId = req.user?.id;

    // Validate action
    const actionValidation = employeeRequestSchema.safeParse({ action, employeeId });
    if (!actionValidation.success) {
      return res.status(400).json({ 
        message: 'Invalid request data',
        errors: actionValidation.error.errors
      });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (!organization.employees.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const requestIndex = organization.employeeRequests.indexOf(employeeId);
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Employee request not found' });
    }

    const newEmployeeRequests = organization.employeeRequests.filter(req => req !== employeeId);
    const newEmployees = action === 'approve' 
      ? [...organization.employees, employeeId]
      : organization.employees;

    const [updatedOrg] = await db
      .update(organizations)
      .set({
        employees: newEmployees,
        employeeRequests: newEmployeeRequests,
        activityLog: [...organization.activityLog, {
          timestamp: new Date().toISOString(),
          employeeId: userId,
          action: `Employee request ${action}d`
        }]
      })
      .where(eq(organizations.id, id))
      .returning();

    res.json({ message: `Employee request ${action}d successfully` });
  } catch (error) {
    console.error('Employee request handling error:', error);
    res.status(500).json({ message: 'Failed to handle employee request' });
  }
});

// Verify business transaction
router.post('/verify-transaction', async (req, res) => {
  try {
    const { organizationId, cost, description, category = 'default' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Validate transaction data with additional fields
    const transactionData = { organizationId, cost, description, category };
    const transactionValidation = verifyTransactionSchema.safeParse(transactionData);
    if (!transactionValidation.success) {
      return res.status(400).json({ 
        message: 'Invalid transaction data',
        errors: transactionValidation.error.errors
      });
    }

    // Sanitize description input
    const sanitizedDescription = sanitizeInput(description);

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (!organization.employees.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Enhanced transaction approval logic with proper type checking
    let approved = false;
    let approvalReason = '';
    const transactionRules: Record<string, number> = {
      default: 10000,
      emergency: 25000,
      recurring: 15000
    };

    // Check if user has admin privileges
    const isAdmin = Array.isArray(organization.adminUsers) && organization.adminUsers.includes(userId);
    
    // Apply different rules based on transaction category and user role
    if (isAdmin) {
      approved = true;
      approvalReason = 'Admin approval';
    } else if (category === 'emergency' && cost <= transactionRules.emergency) {
      approved = true;
      approvalReason = 'Emergency transaction within limit';
    } else if (category === 'recurring' && cost <= transactionRules.recurring) {
      approved = true;
      approvalReason = 'Recurring transaction within limit';
    } else if (cost <= transactionRules.default) {
      approved = true;
      approvalReason = 'Standard transaction within limit';
    } else {
      approvalReason = 'Transaction exceeds approval limit';
    }

    // Add transaction to activity log with enhanced details
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        activityLog: [...organization.activityLog, {
          timestamp: new Date().toISOString(),
          employeeId: userId,
          action: `Business transaction ${approved ? 'approved' : 'rejected'}`,
          cost,
          details: {
            category,
            description: sanitizedDescription,
            approvalReason,
            isAdminAction: isAdmin
          }
        }]
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    // Return enhanced response
    res.json({
      approved,
      reason: approvalReason,
      transactionId: generateSecureToken(16),
      timestamp: new Date().toISOString(),
      details: {
        category,
        cost,
        description: sanitizedDescription
      }
    });
  } catch (error: unknown) {
    console.error('Transaction verification error:', error);
    res.status(500).json({
      message: 'Failed to verify transaction',
      error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
    });
  }
});

// Get organization transaction history
router.get('/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, category } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    if (!organization.employees.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Filter transactions from activity log
    let transactions = organization.activityLog
      .filter(log => log.action.startsWith('Business transaction'));

    // Apply date filters if provided
    if (startDate) {
      transactions = transactions.filter(t => 
        new Date(t.timestamp) >= new Date(startDate as string)
      );
    }
    if (endDate) {
      transactions = transactions.filter(t =>
        new Date(t.timestamp) <= new Date(endDate as string)
      );
    }

    // Apply category filter if provided
    if (category) {
      transactions = transactions.filter(t =>
        t.details?.category === category
      );
    }

    // Calculate statistics
    const stats = {
      total: transactions.length,
      approved: transactions.filter(t => t.action.includes('approved')).length,
      rejected: transactions.filter(t => t.action.includes('rejected')).length,
      totalAmount: transactions.reduce((sum, t) => sum + (t.details?.cost || 0), 0)
    };

    res.json({
      transactions,
      stats
    });
  } catch (error: unknown) {
    console.error('Transaction history error:', error);
    res.status(500).json({
      message: 'Failed to fetch transaction history',
      error: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : String(error) : undefined
    });
  }
});

export default router;